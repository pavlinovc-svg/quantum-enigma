/**
 * Client-side restatement only.
 * Extract what was asked. List what was not asked.
 * Do not invent facts, ranges, programs, or hardware.
 */
(function (global) {
  "use strict";

  var UNASKED_CATALOG = [
    {
      id: "draft",
      label: "a draft or prompt to send onward",
      test: /\b(draft|prompt|write (me |this |a )|script (this|it)|word(s)? this|what (should|can) i (say|send|post)|give me (text|wording|a reply))\b/i,
    },
    {
      id: "decision",
      label: "a decision or commitment from you",
      test: /\b(decide|decision|commit|approve|sign off|greenlight|yes or no|are you in)\b/i,
    },
    {
      id: "advice",
      label: "advice or a recommendation",
      test: /\b(advice|advise|recommend|what (do you|would you) (think|do)|should i|thoughts on)\b/i,
    },
    {
      id: "apology",
      label: "an apology",
      test: /\b(apolog(y|ise|ize)|sorry|owe .+ an apology)\b/i,
    },
    {
      id: "praise",
      label: "praise or validation",
      test: /\b(proud of me|what do you think of (this|my)|rate this|feedback on my|did i do (good|well)|be honest)\b/i,
    },
    {
      id: "timeline",
      label: "a timeline, ETA, or deadline",
      test: /\b(when (can|will|do)|deadline|eta|timeline|by (when|friday|monday|tomorrow)|how soon|how long)\b/i,
    },
    {
      id: "escalate",
      label: "escalation, forwarding, or bringing in others",
      test: /\b(escalate|forward|cc |loop in|bring in|tell (them|the team|the boss)|raise this)\b/i,
    },
    {
      id: "yesno",
      label: "a yes / no",
      test: /\b((can|could|would|will|do|did|are|is) you\b|yes or no|y\/n)\b/i,
    },
    {
      id: "review",
      label: "a review of their work",
      test: /\b(review|look (this|it) over|check my|proofread|lgtm|nits)\b/i,
    },
    {
      id: "meeting",
      label: "a meeting time or call",
      test: /\b(meet|call|zoom|sync|hop on|available (to|for)|calendar)\b/i,
    },
    {
      id: "money",
      label: "money, budget, or resources",
      test: /\b(pay|paid|invoice|budget|cost|price|funding|headcount)\b/i,
    },
  ];

  var PRIDE_WORK =
    /\b(i (just )?(built|made|wrote|designed|created|finished|shipped|implemented|coded|drew|painted|composed|launched)|look at (this|what)|check this out|proud of|my (work|project|design|build)|take a look|i spent|here('?s| is) what i (did|made|built)|i got it (working|done))\b/i;

  var DRAFTISH =
    /\b(here('?s| is) (a |the )?(prompt|draft|template|script)|prompt\s*:|draft\s*:|system\s*:|you are (a|an)\b|copy and paste|you can send this|paste this)\b/i;

  function splitSentences(text) {
    return String(text || "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function isQuestion(s) {
    return (
      /\?\s*$/.test(s) ||
      /^(who|what|when|where|why|how|is|are|do|does|did|can|could|would|will|should|have|has|am)\b/i.test(
        s
      )
    );
  }

  function isImperative(s) {
    return (
      /^(please\s+)?(send|tell|give|let|make|do|don'?t|stop|start|reply|respond|look|check|review|confirm|share|explain|write|draft|fix|update|lmk|need|want)\b/i.test(
        s
      ) ||
      /\b(can you|could you|would you|please|need you to|i need you to|i want you to|you should|you need to|let me know)\b/i.test(
        s
      )
    );
  }

  function shorten(s, max) {
    max = max || 160;
    var t = s.replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }

  function stripGreeting(s) {
    return s.replace(
      /^(hey|hi|hello|yo|sup|good (morning|afternoon|evening))[,.\s]+/i,
      ""
    );
  }

  function restateAsk(text, relationship, channel) {
    var raw = String(text || "").trim();
    if (!raw) {
      return {
        sentence: "No incoming message yet — nothing to restate.",
        unasked: [],
        asks: [],
        showedPrideOrWork: false,
        askedForDraft: false,
      };
    }

    var sentences = splitSentences(raw);
    var asks = sentences.filter(function (s) {
      return isQuestion(s) || isImperative(s);
    });

    var sentence;
    if (asks.length === 0) {
      sentence =
        "They shared a message with no clear question or order — sharing, not requesting.";
    } else {
      var first = stripGreeting(asks[0]).replace(/[?]+$/, "").trim();
      sentence = "They are asking you to address: “" + shorten(first, 140) + "”.";
    }

    if (relationship && relationship.trim()) {
      sentence += " Relationship noted as " + relationship.trim() + ".";
    }
    if (channel && channel.trim()) {
      sentence += " Channel: " + channel.trim() + ".";
    }

    var unasked = [];
    for (var i = 0; i < UNASKED_CATALOG.length; i++) {
      var item = UNASKED_CATALOG[i];
      if (!item.test.test(raw)) {
        unasked.push(item.label);
      }
    }

    return {
      sentence: sentence,
      unasked: unasked,
      asks: asks,
      showedPrideOrWork: PRIDE_WORK.test(raw),
      askedForDraft: UNASKED_CATALOG[0].test.test(raw),
    };
  }

  function looksLikeDraftOrPrompt(text) {
    return DRAFTISH.test(String(text || ""));
  }

  global.QEHeuristic = {
    restateAsk: restateAsk,
    looksLikeDraftOrPrompt: looksLikeDraftOrPrompt,
    showedPrideOrWork: function (text) {
      return PRIDE_WORK.test(String(text || ""));
    },
  };
})(window);
