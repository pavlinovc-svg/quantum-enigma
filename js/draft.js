/**
 * Client-side draft + score.
 * Spine is QEHeuristic.analyze: restated ask, unasked list, pride/work, draft-asked.
 * No LLM. No invented ranges, programs, dates, or a CRQC.
 * Replies are ordinary language, first person as the person answering.
 */
(function (global) {
  "use strict";

  var H = function () {
    return global.QEHeuristic;
  };

  var AXIS_ORDER = ["truth", "outcome", "restraint", "mission", "risk"];

  var TEMPLATE_PROPER = {
    i: 1,
    "i'll": 1,
    "i'm": 1,
    "i've": 1,
    "i’m": 1,
    "i’ll": 1,
    "i’ve": 1,
    you: 1,
    your: 1,
    when: 1,
    which: 1,
    there: 1,
    this: 1,
    that: 1,
    not: 1,
    noted: 1,
    received: 1,
    holding: 1,
    scope: 1,
    cannot: 1,
    wording: 1,
    following: 1,
    yes: 1,
    do: 1,
    if: 1,
    for: 1,
    using: 1,
    please: 1,
    nothing: 1,
    acknowledged: 1,
    stay: 1,
    keep: 1,
    can: 1,
  };

  var PRAISE =
    /\b(excellent|amazing|awesome|brilliant|perfect|genius|outstanding|incredible|fantastic|great job|so proud|impressed)\b/i;

  var CRQC = /\b(crqc|cryptographically relevant)\b/i;

  function voiceOf(channel, relationship) {
    var ch = String(channel || "").toLowerCase();
    var rel = String(relationship || "").toLowerCase();
    var warmth = "neutral";
    if (ch === "friend dm" || rel === "friend") warmth = "warm";
    else if (ch === "command thread") warmth = "tight";
    else if (ch === "public post") warmth = "careful";
    else if (ch === "email") warmth = "even";
    else if (ch === "group chat") warmth = "warm";
    return {
      channel: ch,
      warmth: warmth,
      friend: warmth === "warm",
      public: warmth === "careful",
    };
  }

  function vocative(ctx) {
    var n = ctx.senders && ctx.senders[0];
    if (
      ctx.voice.warmth === "warm" &&
      n &&
      !/^(you|your|i|we|they|it|this|that|hey|hi)$/i.test(n)
    ) {
      return n + " — ";
    }
    return "";
  }

  function cap(s) {
    s = String(s || "").trim();
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function quote(s, max) {
    return "“" + H().shorten(s, max || 80) + "”";
  }

  function asYouClause(sentence) {
    var s = H().stripGreeting(sentence).replace(/[.!?]+$/, "").trim();
    s = s
      .replace(/\bi['’]ve\b/gi, "you've")
      .replace(/\bi['’]m\b/gi, "you're")
      .replace(/\bi['’]ll\b/gi, "you'll")
      .replace(/\bi['’]d\b/gi, "you'd")
      .replace(/\bi\b/gi, "you")
      .replace(/\bmy\b/gi, "your")
      .replace(/\bme\b/gi, "you");
    if (!/^you\b/i.test(s)) s = "you " + s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function prideObservation(ctx) {
    var p = ctx.prideSentence;
    if (!p) return "";
    if (/\bi\b/i.test(p)) return cap(asYouClause(p)) + ".";
    if (/^here\b/i.test(H().stripGreeting(p))) return "You shared what you already did.";
    if (ctx.objectPhrase) return "You brought " + ctx.objectPhrase + ".";
    return "You showed the work you already did.";
  }

  function topic(ctx) {
    if (ctx.objectPhrase && ctx.objectPhrase.split(/\s+/).length >= 2) {
      return ctx.objectPhrase;
    }
    if (ctx.askShort) return quote(ctx.askShort, 56);
    return "this";
  }

  function nums(s) {
    return String(s || "").match(/\b\d+(?:\.\d+)?\b/g) || [];
  }

  function dayHits(s) {
    var re =
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|yesterday|eod|eow|january|february|march|april|june|july|august|september|october|november|december)\b/gi;
    var out = [];
    var m;
    while ((m = re.exec(String(s || "")))) {
      out.push(m[1].toLowerCase());
    }
    return out;
  }

  function properTokens(s) {
    var parts = String(s || "").split(/(?<=[.!?])\s+|\n+/);
    var out = [];
    parts.forEach(function (p) {
      var words = p.split(/\s+/);
      words.forEach(function (w, i) {
        if (i === 0) return;
        var m = String(w || "").match(/^[A-Z][a-z]{2,}/);
        if (m) out.push(m[0]);
      });
    });
    return out;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function wordCount(s) {
    return String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function truthOf(reply, source) {
    var score = 5;
    var why = "adds no facts beyond the ciphertext";
    var extraNums = nums(reply).filter(function (n) {
      return nums(source).indexOf(n) === -1;
    });
    if (extraNums.length) {
      return { score: 1, why: "drops hard: number not in the incoming message" };
    }
    var extraDays = dayHits(reply).filter(function (d) {
      return dayHits(source).indexOf(d) === -1;
    });
    if (extraDays.length) {
      return { score: 1, why: "drops hard: date or day not in the incoming message" };
    }
    if (CRQC.test(reply) && !CRQC.test(source)) {
      return { score: 0, why: "drops hard: invented a CRQC" };
    }
    if (PRAISE.test(reply) && !PRAISE.test(source)) {
      return {
        score: 1,
        why: "drops hard: invented praise of facts not in the text",
      };
    }
    var srcProper = properTokens(source).map(function (x) {
      return x.toLowerCase();
    });
    var extraProper = properTokens(reply).filter(function (p) {
      var k = p.toLowerCase();
      if (TEMPLATE_PROPER[k]) return false;
      return srcProper.indexOf(k) === -1;
    });
    if (extraProper.length) {
      score = 2;
      why = "drops: proper name or program not in the incoming message";
    }
    return { score: score, why: why };
  }

  function restraintOf(reply, slot) {
    var n = wordCount(reply);
    var extra = /\b(i can also|let me also|happy to also|while i'm at it|bonus)\b/i.test(
      reply
    );
    var score;
    if (slot === "draft") score = n <= 28 ? 3 : 2;
    else if (n <= 18) score = 5;
    else if (n <= 32) score = 4;
    else if (n <= 48) score = 3;
    else score = 2;
    if (extra) score = Math.min(score, 1);
    if (slot === "wait" || slot === "reflect") score = Math.max(score, 4);
    var why;
    if (extra) why = "volunteers extra work";
    else if (slot === "draft") why = "a draft is extra labor, kept short";
    else if (n <= 18) why = "short, no extra work volunteered";
    else why = "kept short; no extra work volunteered";
    return { score: clamp(score, 0, 5), why: why };
  }

  function outcomeOf(slot, ctx, truthScore) {
    var hasAsk = ctx.asks.length > 0;
    var prideGround = ctx.showedPrideOrWork && truthScore >= 4;
    if (slot === "reflect") {
      if (prideGround) {
        return {
          score: 5,
          why: "correctly stays with the work they already showed; does not take an unanswerable ask",
        };
      }
      if (!hasAsk) {
        return {
          score: 5,
          why: "no ask to answer — acknowledgment is the legal move",
        };
      }
      return {
        score: 2,
        why: "does not answer the restated ask; it only reflects",
      };
    }
    if (slot === "wait") {
      if (!hasAsk) {
        return { score: 4, why: "correctly waits; there is no ask to fill" };
      }
      return {
        score: 3,
        why: "correctly refuses to send an answer this cycle",
      };
    }
    if (slot === "direct") {
      if (!hasAsk) {
        return {
          score: 4,
          why: "states there is no ask, which is the honest answer",
        };
      }
      return {
        score: 5,
        why: "answers the restated ask or correctly refuses it without invented facts",
      };
    }
    if (slot === "clarify") {
      return {
        score: 3,
        why: "moves the restated ask forward without pretending to close it",
      };
    }
    if (slot === "boundary") {
      return {
        score: 3,
        why: "keeps the lane of the restated ask; does not take unasked work",
      };
    }
    if (slot === "draft") {
      if (ctx.askedForDraft) {
        return {
          score: 4,
          why: "they asked for wording; this is that reply, using only their words",
        };
      }
      return { score: 1, why: "a draft they did not ask for" };
    }
    return { score: 3, why: "partial fit to the restated ask" };
  }

  function missionOf(slot, ctx, friendMode) {
    var command = ctx.voice.warmth === "tight";
    var friend = ctx.voice.friend || friendMode;
    var pub = ctx.voice.public;
    var pride = ctx.showedPrideOrWork;
    var urgent = ctx.catalogHits.timeline || /\b(confirm|eod|asap|now)\b/i.test(ctx.raw);

    if (command) {
      if (slot === "direct") return { score: 5, why: "command thread: answers or refuses the order" };
      if (slot === "boundary") return { score: 4, why: "command thread: holds scope" };
      if (slot === "clarify") return { score: 4, why: "command thread: pins the order" };
      if (slot === "wait") {
        return {
          score: urgent ? 2 : 3,
          why: urgent
            ? "command thread asked for a confirm; waiting underserves it"
            : "command thread: a hold is legal but thin",
        };
      }
      if (slot === "reflect") {
        return {
          score: pride ? 3 : 2,
          why: "command thread: reflection is not the job unless they showed work",
        };
      }
      if (slot === "draft") {
        return {
          score: ctx.askedForDraft ? 4 : 1,
          why: ctx.askedForDraft
            ? "command thread: they asked for wording"
            : "command thread: unasked draft",
        };
      }
    }

    if (pub) {
      if (slot === "wait" || slot === "boundary") {
        return { score: 5, why: "public post: careful non-expansion is the job" };
      }
      if (slot === "reflect") {
        return { score: 4, why: "public post: acknowledge without oversharing" };
      }
      if (slot === "clarify") {
        return { score: 3, why: "public post: a question can pull more into the open" };
      }
      if (slot === "direct") {
        return { score: 4, why: "public post: refuse to invent, without oversharing" };
      }
      if (slot === "draft") {
        return { score: 2, why: "public post: a sendable draft is extra surface" };
      }
    }

    if (friend) {
      if (slot === "reflect" && pride) {
        return { score: 5, why: "friend thread: see the work they brought" };
      }
      if (slot === "reflect") {
        return { score: 4, why: "friend thread: acknowledgment fits" };
      }
      if (slot === "wait" || slot === "direct" || slot === "clarify") {
        return { score: 4, why: "friend thread: honest and light" };
      }
      if (slot === "boundary") {
        return { score: 3, why: "friend thread: a boundary is legal, a little stiff" };
      }
      if (slot === "draft") {
        return {
          score: ctx.askedForDraft ? 3 : 1,
          why: ctx.askedForDraft
            ? "friend thread: wording they asked for"
            : "friend thread: unasked draft",
        };
      }
    }

    if (slot === "direct") return { score: 5, why: "serves the job of the thread" };
    if (slot === "reflect" && pride) return { score: 4, why: "they showed work; seeing it serves the thread" };
    if (slot === "clarify" || slot === "boundary") return { score: 4, why: "keeps the thread on the actual job" };
    if (slot === "wait") return { score: 3, why: "a hold is legal" };
    if (slot === "draft") {
      return {
        score: ctx.askedForDraft ? 4 : 1,
        why: ctx.askedForDraft ? "they asked for wording" : "unasked draft",
      };
    }
    return { score: 3, why: "partial fit to the job of the thread" };
  }

  function riskOf(slot, ctx, truthScore) {
    if (slot === "draft" && !ctx.askedForDraft) {
      return { score: 1, why: "sending a draft they did not ask for" };
    }
    if (truthScore <= 1) {
      return { score: 1, why: "invented content is a leak and an overcommit" };
    }
    if (slot === "wait") {
      return { score: 5, why: "prices downside: nothing is sent" };
    }
    if (slot === "reflect") {
      return { score: 5, why: "prices downside: no commit, no draft, no leak" };
    }
    if (slot === "boundary") {
      return { score: 4, why: "prices downside: refuses unasked work" };
    }
    if (slot === "clarify") {
      return { score: 4, why: "prices downside: asks instead of committing" };
    }
    if (slot === "direct") {
      return { score: 4, why: "prices downside: answers without inventing" };
    }
    if (slot === "draft") {
      return { score: 3, why: "prices downside: a draft can be forwarded as-is" };
    }
    return { score: 3, why: "mid downside" };
  }

  function scoreCandidate(slot, text, ctx, friendMode) {
    var t = truthOf(text, ctx.raw);
    var o = outcomeOf(slot, ctx, t.score);
    var r = restraintOf(text, slot);
    var m = missionOf(slot, ctx, friendMode);
    var k = riskOf(slot, ctx, t.score);
    return {
      scores: {
        truth: t.score,
        outcome: o.score,
        restraint: r.score,
        mission: m.score,
        risk: k.score,
      },
      why: {
        truth: t.why,
        outcome: o.why,
        restraint: r.why,
        mission: m.why,
        risk: k.why,
      },
    };
  }

  function draftReflect(ctx) {
    var v = vocative(ctx);
    var w = ctx.voice.warmth;
    var seen = prideObservation(ctx);
    if (seen) {
      if (w === "warm") return v + seen + " I see the work.";
      if (w === "tight") {
        return (
          "Noted: " +
          H().stripGreeting(ctx.prideSentence).replace(/[.!?]+$/, "") +
          "."
        );
      }
      if (w === "careful") {
        return seen + " I’m acknowledging that, not adding a public take.";
      }
      return seen + " I see that.";
    }
    if (ctx.facts[0]) {
      var fact = quote(H().stripGreeting(ctx.facts[0]).replace(/[.!?]+$/, ""), 70);
      if (w === "tight") return "Received. You wrote " + fact + ". No take.";
      if (w === "careful") return "You wrote " + fact + ". I’m not adding a public take.";
      return v + "I read " + fact + ". I’m not adding a take yet.";
    }
    if (w === "tight") return "Received. No take.";
    if (w === "careful") return "I read the message. I’m not adding a public response yet.";
    return v + "I read what you sent. I’m not adding a take yet.";
  }

  function draftWait(ctx) {
    var v = vocative(ctx);
    var w = ctx.voice.warmth;
    var t = topic(ctx);
    if (w === "tight") {
      return "Holding on " + t + ". No answer this cycle.";
    }
    if (w === "careful") {
      return "Not engaging " + t + " in public yet.";
    }
    if (w === "warm") {
      return v + "I’m going to sit on " + t + " for now. Nothing going out yet.";
    }
    return "Not answering " + t + " yet.";
  }

  function draftDirect(ctx) {
    var w = ctx.voice.warmth;
    var ask = ctx.askShort;
    var hits = ctx.catalogHits;
    var v = vocative(ctx);

    if (!ctx.asks.length) {
      if (w === "tight") return "No question or order in this traffic. I read it.";
      return v + "There’s no question or order in this message for me to answer. I read it.";
    }

    var joined = ctx.asks.join(" ");
    if (
      /\b(did you (see|get|read|hear)|have you (seen|read|got)|you see)\b/i.test(joined) &&
      ctx.prideSentence
    ) {
      return prideObservation(ctx) + " Yes — I see that.";
    }

    var q = quote(ask, 72);

    if (ask.replace(/[^\w\s]/g, "").trim().length < 6 && ctx.facts.length === 0 && !ctx.prideSentence) {
      if (w === "tight") return "Nothing in this traffic to answer. I will not invent a fill.";
      return "There’s almost nothing in this message to answer. I won’t invent a reply to fill the gap.";
    }

    if (
      hits.review ||
      /\b(look .+ over|review|check my|look right|proofread|take a look|have a look)\b/i.test(
        ask + " " + ctx.raw
      )
    ) {
      if (w === "tight") {
        return "Cannot review " + (ctx.objectPhrase || "this") + " from this traffic. The work is not in the text. No invented verdict.";
      }
      return (
        "I can’t review " +
        (ctx.objectPhrase || "what you asked me to look at") +
        " from this message alone — the work itself isn’t in the text. I won’t invent a verdict."
      );
    }

    if (hits.timeline) {
      return (
        "This message doesn’t include a time I can commit to for " +
        q +
        ". I won’t invent a deadline or ETA."
      );
    }

    if (hits.money) {
      return "There’s no figure in this message I can confirm. I won’t invent a cost, budget, or number.";
    }

    if (hits.decision) {
      if (w === "tight") return "No decision or commitment from this traffic alone.";
      return "I’m not making a decision or commitment from this message alone.";
    }

    if (hits.advice || hits.praise) {
      return (
        "I don’t have enough in this message to judge or advise on " +
        q +
        " without making things up. I won’t."
      );
    }

    if (hits.yesno || H().isYesNo(ctx.asks[0])) {
      return "I can’t give a yes or no on " + q + " from what’s in this message. I won’t invent one.";
    }

    if (w === "tight") {
      return "Cannot answer " + q + " from this traffic. No invented facts.";
    }
    if (w === "careful") {
      return "I can’t answer " + q + " from the facts in this post. I won’t invent the missing ones in public.";
    }
    return v + "I can’t answer " + q + " from the facts in this message. I won’t invent the missing ones.";
  }

  function draftClarify(ctx) {
    var v = vocative(ctx);
    if (ctx.asks.length >= 2) {
      var a0 = H().shorten(H().stripGreeting(ctx.asks[0]).replace(/[.!?]+$/, ""), 48);
      var a1 = H().shorten(H().stripGreeting(ctx.asks[1]).replace(/[.!?]+$/, ""), 48);
      return v + "Which do you want first — " + quote(a0, 48) + " or " + quote(a1, 48) + "?";
    }
    if (ctx.catalogHits.review) {
      return (
        "When you say " +
        quote(ctx.askShort || "look this over", 56) +
        ", do you want a line-by-line look or a go / no-go?"
      );
    }
    if (ctx.askedForDraft && ctx.askShort) {
      return (
        "Do you want an answer to " +
        quote(ctx.askShort, 56) +
        ", or wording you can send?"
      );
    }
    if (ctx.askShort) {
      return (
        "When you say " +
        quote(ctx.askShort, 64) +
        ", what would a useful answer actually look like?"
      );
    }
    return "What would a useful reply to this actually look like?";
  }

  function draftBoundary(ctx) {
    var w = ctx.voice.warmth;
    var v = vocative(ctx);
    var ask = ctx.askShort;
    var extra = ctx.unasked[0];
    if (ctx.askedForDraft) {
      extra = ctx.unasked.filter(function (x) {
        return x.indexOf("draft") === -1;
      })[0] || extra;
    }
    if (ask && extra) {
      if (w === "tight") {
        return "Scope is " + quote(ask, 56) + ". Not expanding past that ask.";
      }
      if (w === "careful") {
        return "I’ll keep this to " + quote(ask, 56) + ". I’m not taking the rest in public.";
      }
      return (
        v +
        "I’ll stay with " +
        quote(ask, 56) +
        ". I’m not adding work you didn’t ask for."
      );
    }
    if (ask) {
      return (
        "I can address " +
        quote(ask, 64) +
        " and that’s the lane. I’m not adding work you didn’t ask for."
      );
    }
    return "I’m not taking on work this message didn’t ask for.";
  }

  function draftWording(ctx) {
    var bits = [];
    if (ctx.prideSentence && /\bi\b/i.test(ctx.prideSentence)) {
      bits.push(H().stripGreeting(ctx.prideSentence).replace(/[.!?]+$/, "").trim());
    } else if (ctx.facts[0]) {
      bits.push(H().stripGreeting(ctx.facts[0]).replace(/[.!?]+$/, "").trim());
    } else if (ctx.objectPhrase) {
      bits.push("Following up on " + ctx.objectPhrase);
    }
    bits = bits
      .map(function (b) {
        return String(b || "")
          .replace(/^[\s\-–—]+/, "")
          .trim();
      })
      .filter(Boolean);

    if (!bits.length) {
      return "You asked for wording. There isn’t enough in the message to write it without inventing. I won’t.";
    }

    var body = cap(bits[0]) + ".";
    if (ctx.voice.warmth === "tight") {
      return "Wording you asked for, using only what you already said: " + body;
    }
    if (ctx.voice.warmth === "careful") {
      return "You asked for wording. Only from what you already wrote: " + body;
    }
    return "You asked for wording. Using only what you already wrote, you could send: " + body;
  }

  function pack(slot, tag, text, ctx, friendMode) {
    var scored = scoreCandidate(slot, text, ctx, friendMode);
    return {
      slot: slot,
      tag: tag,
      text: text,
      scores: scored.scores,
      why: scored.why,
    };
  }

  function draftAndScore(text, relationship, channel, opts) {
    opts = opts || {};
    var analysis = H().analyze(text, relationship, channel);
    if (!analysis.raw) {
      return { analysis: analysis, candidates: [] };
    }
    var ctx = Object.assign({}, analysis, {
      voice: voiceOf(channel, relationship),
    });
    var friendMode = !!opts.friendMode || ctx.voice.friend;

    var list = [
      pack("reflect", "reflect", draftReflect(ctx), ctx, friendMode),
      pack("wait", "wait", draftWait(ctx), ctx, friendMode),
      pack("direct", null, draftDirect(ctx), ctx, friendMode),
      pack("clarify", null, draftClarify(ctx), ctx, friendMode),
      pack("boundary", null, draftBoundary(ctx), ctx, friendMode),
    ];

    if (analysis.askedForDraft) {
      list.push(pack("draft", null, draftWording(ctx), ctx, friendMode));
    } else {
      list = list.filter(function (c) {
        return c.slot !== "draft";
      });
      list.forEach(function (c) {
        if (H().looksLikeDraftOrPrompt(c.text)) {
          c.text =
            "I read what you sent. I’m not writing a draft or prompt — you didn’t ask for one.";
          var scored = scoreCandidate(c.slot, c.text, ctx, friendMode);
          c.scores = scored.scores;
          c.why = scored.why;
        }
      });
    }

    return { analysis: analysis, candidates: list };
  }

  global.QEDraft = {
    draftAndScore: draftAndScore,
    scoreCandidate: scoreCandidate,
    AXIS_ORDER: AXIS_ORDER,
  };
})(typeof window !== "undefined" ? window : globalThis);
