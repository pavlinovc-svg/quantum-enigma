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
    /\b(i(?:\s+\w+){0,3}\s+(built|made|wrote|designed|created|finished|shipped|implemented|coded|drew|painted|composed|launched|got)|look at (this|what)|check this out|proud of|my (work|project|design|build)|take a look|i spent|here('?s| is) what i (did|made|built)|i got it (working|done))\b/i;

  var DRAFTISH =
    /\b(here('?s| is) (a |the )?(prompt|draft|template|script)|prompt\s*:|draft\s*:|system\s*:|you are (a|an)\b|copy and paste|you can send this|paste this)\b/i;

  var NAME_BLOCK = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|I|We|You|The|This|That|What|When|Where|Why|How|Please|Thanks|Thank|Hi|Hey|Hello|Ok|Okay|Yes|No|Can|Could|Would|Will|Did|Does|Are|Is|Just|Also|And)$/i;

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
      /^(please\s+)?(send|tell|give|let|make|do|don'?t|stop|start|reply|respond|look|check|review|confirm|share|explain|write|draft|fix|update|lmk|need|want|take a look|have a look|be honest)\b/i.test(
        s
      ) ||
      /\b(can you|could you|would you|please|need you to|i need you to|i want you to|you should|you need to|let me know|take a look|have a look|be honest)\b/i.test(
        s
      )
    );
  }

  function isYesNo(s) {
    var t = stripGreeting(s);
    return (
      /^(are|is|do|did|does|can|could|would|will|have|has|am|should)\b/i.test(t) ||
      /\byes or no\b/i.test(t)
    );
  }

  function shorten(s, max) {
    max = max || 160;
    var t = String(s || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }

  function stripGreeting(s) {
    return String(s || "")
      .replace(
        /^(hey|hi|hello|yo|sup|dude|bro|man|dear|good (morning|afternoon|evening))(?:\s+[A-Z][a-z]{1,20})?[\s,.\-–—]+/i,
        ""
      )
      .replace(/^[\s\-–—]+/, "")
      .trim();
  }

  function catalogState(raw) {
    var hits = {};
    var asked = [];
    var unasked = [];
    for (var i = 0; i < UNASKED_CATALOG.length; i++) {
      var item = UNASKED_CATALOG[i];
      var hit = item.test.test(raw);
      hits[item.id] = hit;
      if (hit) asked.push(item.label);
      else unasked.push(item.label);
    }
    return { hits: hits, asked: asked, unasked: unasked };
  }

  function addName(list, n) {
    n = String(n || "").trim();
    if (!n || NAME_BLOCK.test(n) || n.length < 2) return;
    if (list.indexOf(n) === -1) list.push(n);
  }

  function extractAddressees(raw) {
    var found = [];
    var re = /\b(?:hey|hi|hello|yo|dear)\s+([A-Z][a-z]{1,20})\b/g;
    var m;
    while ((m = re.exec(raw))) addName(found, m[1]);
    return found;
  }

  function extractSenders(raw) {
    var found = [];
    var reAt = /@([A-Za-z][A-Za-z0-9_-]{1,20})/g;
    var m;
    while ((m = reAt.exec(raw))) addName(found, m[1]);
    var reSign =
      /(?:^|\n)\s*(?:[-–—]{1,2}|thanks|thank you|cheers|best|regards)[, ]+([A-Z][a-z]{2,20})\s*$/im;
    m = raw.match(reSign);
    if (m) addName(found, m[1]);
    return found;
  }

  function prideSentenceOf(raw, sentences) {
    var i;
    var fallback = "";
    for (i = 0; i < sentences.length; i++) {
      if (!PRIDE_WORK.test(sentences[i])) continue;
      if (/\bi\b/i.test(sentences[i])) return sentences[i];
      if (!fallback) fallback = sentences[i];
    }
    if (fallback) return fallback;
    var m = raw.match(PRIDE_WORK);
    return m ? m[0] : "";
  }

  function objectPhraseOf(pride) {
    var src = String(pride || "");
    if (!src) return "";
    var m = src.match(
      /\b(?:built|made|wrote|designed|created|finished|shipped|implemented|coded|drew|painted|composed|launched|got)\s+(?:me\s+)?(.+)$/i
    );
    if (m) {
      var obj = m[1]
        .replace(/[.!?]+$/, "")
        .replace(/\b(before|after|when|if|and|but|so|because|or)\b[\s\S]*$/i, "")
        .replace(/\b(built|made|done|working)\s*$/i, "")
        .trim();
      if (obj && !/^(a|an|the|this|look|take|look at this)$/i.test(obj)) {
        return shorten(obj, 48);
      }
    }
    m = src.match(/\b(?:the|my)\s+[a-z0-9][\w'’-]*(?:\s+[a-z0-9][\w'’-]*){0,3}/i);
    if (m) {
      var phrase = m[0]
        .replace(/\b(before|after|when|if|and|but|so|or|this weekend)\b[\s\S]*$/i, "")
        .trim();
      if (!/^(the|my)\s+(look|take|message|text)$/i.test(phrase)) {
        return shorten(phrase, 48);
      }
    }
    return "";
  }

  function analyze(text, relationship, channel) {
    var raw = String(text || "").trim();
    var relationshipN = String(relationship || "").trim();
    var channelN = String(channel || "").trim();
    if (!raw) {
      return {
        sentence: "No incoming message yet — nothing to restate.",
        unasked: [],
        asked: [],
        asks: [],
        questions: [],
        imperatives: [],
        facts: [],
        showedPrideOrWork: false,
        askedForDraft: false,
        catalogHits: {},
        addressees: [],
        senders: [],
        prideSentence: "",
        objectPhrase: "",
        askShort: "",
        relationship: relationshipN,
        channel: channelN,
        raw: "",
      };
    }

    var sentences = splitSentences(raw);
    var questions = [];
    var imperatives = [];
    var facts = [];
    var asks = [];
    var i;
    for (i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      var q = isQuestion(s);
      var imp = isImperative(s);
      if (q) questions.push(s);
      if (imp && !q) imperatives.push(s);
      if (q || imp) {
        asks.push(s);
        continue;
      }
      facts.push(s);
    }

    var sentence;
    if (asks.length === 0) {
      sentence =
        "They shared a message with no clear question or order — sharing, not requesting.";
    } else {
      var first = stripGreeting(asks[0]).replace(/[.!?]+$/, "").trim();
      sentence = "They are asking you to address: “" + shorten(first, 140) + "”.";
    }

    if (relationshipN) {
      sentence += " Relationship noted as " + relationshipN + ".";
    }
    if (channelN) {
      sentence += " Channel: " + channelN + ".";
    }

    var cat = catalogState(raw);
    var prideSentence = prideSentenceOf(raw, sentences);
    var askShort = asks.length
      ? shorten(stripGreeting(asks[0]).replace(/[.!?]+$/, "").trim(), 90)
      : "";

    return {
      sentence: sentence,
      unasked: cat.unasked,
      asked: cat.asked,
      asks: asks,
      questions: questions,
      imperatives: imperatives,
      facts: facts,
      showedPrideOrWork: PRIDE_WORK.test(raw),
      askedForDraft: cat.hits.draft,
      catalogHits: cat.hits,
      addressees: extractAddressees(raw),
      senders: extractSenders(raw),
      prideSentence: prideSentence,
      objectPhrase: objectPhraseOf(prideSentence),
      askShort: askShort,
      relationship: relationshipN,
      channel: channelN,
      raw: raw,
    };
  }

  function restateAsk(text, relationship, channel) {
    var a = analyze(text, relationship, channel);
    return {
      sentence: a.sentence,
      unasked: a.unasked,
      asks: a.asks,
      showedPrideOrWork: a.showedPrideOrWork,
      askedForDraft: a.askedForDraft,
    };
  }

  function looksLikeDraftOrPrompt(text) {
    return DRAFTISH.test(String(text || ""));
  }

  global.QEHeuristic = {
    UNASKED_CATALOG: UNASKED_CATALOG,
    restateAsk: restateAsk,
    analyze: analyze,
    looksLikeDraftOrPrompt: looksLikeDraftOrPrompt,
    showedPrideOrWork: function (text) {
      return PRIDE_WORK.test(String(text || ""));
    },
    splitSentences: splitSentences,
    isQuestion: isQuestion,
    isImperative: isImperative,
    isYesNo: isYesNo,
    shorten: shorten,
    stripGreeting: stripGreeting,
  };
})(typeof window !== "undefined" ? window : globalThis);
