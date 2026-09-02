/**
 * QUANTUM ENIGMA UI — prepare → score → interfere → measure
 * Collapse is gated on a human confirm. Nothing is sent anywhere.
 */
(function () {
  "use strict";

  var AXES = ["truth", "outcome", "restraint", "mission", "risk"];
  var AXIS_HINT = {
    truth: "Does this reply stay inside what you actually know?",
    outcome: "Does it buy the outcome this thread can deliver?",
    restraint: "Does it refuse extra work, heat, or performance?",
    mission: "Does it serve the actual job, not the vibe?",
    risk: "How well it prices the downside (higher = better handled).",
  };

  var state = {
    candidates: [blank(0), blank(1), blank(2), blank(3)],
    dirty: true,
    result: null,
    collapsed: null,
  };

  function blank(i) {
    return {
      id: "c" + i + "-" + Math.random().toString(36).slice(2, 7),
      text: "",
      tag: null,
      scores: { truth: 0, outcome: 0, restraint: 0, mission: 0, risk: 0 },
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function friendMode() {
    return $("friend-mode").checked;
  }

  function weights() {
    return QEQuantum.weightsFor(friendMode());
  }

  function filled() {
    return state.candidates.filter(function (c) {
      return c.text.trim().length > 0;
    });
  }

  function analysis() {
    var ch = $("channel");
    var channelLabel = ch.options[ch.selectedIndex].text;
    return QEHeuristic.restateAsk(
      $("ciphertext").value,
      $("relationship").value,
      channelLabel
    );
  }

  function hasTag(name) {
    return filled().some(function (c) {
      return c.tag === name;
    });
  }

  function allScored(list) {
    return list.every(function (c) {
      return AXES.some(function (a) {
        return (c.scores[a] || 0) > 0;
      });
    });
  }

  function audit() {
    var list = filled();
    var a = analysis();
    var items = [
      { ok: !!$("ciphertext").value.trim(), label: "Incoming message entered" },
      { ok: list.length >= 4, label: "At least four sendable replies written" },
      { ok: hasTag("reflect"), label: "One candidate tagged reflect-only" },
      { ok: hasTag("wait"), label: "One candidate tagged no / wait / ignore" },
      { ok: list.length >= 4 && allScored(list), label: "Those replies scored on at least one axis" },
    ];
    return {
      items: items,
      ready: items.every(function (x) {
        return x.ok;
      }),
      analysis: a,
      list: list,
    };
  }

  function renderRestate() {
    var a = analysis();
    $("restate-sentence").textContent = a.sentence;
    var ul = $("unasked-list");
    ul.innerHTML = "";
    if (!$("ciphertext").value.trim()) {
      var li0 = document.createElement("li");
      li0.textContent =
        "Enter a message to list what was not asked. The list is a heuristic, not a claim about intent.";
      ul.appendChild(li0);
    } else if (a.unasked.length === 0) {
      var li1 = document.createElement("li");
      li1.textContent =
        "The heuristic found wording for every catalogued ask it knows. That is not proof they asked for everything.";
      ul.appendChild(li1);
    } else {
      a.unasked.forEach(function (label) {
        var li = document.createElement("li");
        li.textContent = "Not asked: " + label + ".";
        ul.appendChild(li);
      });
    }
    $("pride-hint").hidden = !a.showedPrideOrWork;
  }

  function renderWeights() {
    var w = weights();
    $("weights-line").textContent =
      "Eᵢ = −( " +
      w.truth.toFixed(3) +
      "·truth + " +
      w.outcome.toFixed(3) +
      "·outcome + " +
      w.restraint.toFixed(3) +
      "·restraint + " +
      w.mission.toFixed(3) +
      "·mission + " +
      w.risk.toFixed(3) +
      "·risk )   Σw = " +
      (w.truth + w.outcome + w.restraint + w.mission + w.risk).toFixed(3) +
      (friendMode() ? "   · friend-thread" : "   · default");
  }

  function setTag(card, tag) {
    state.candidates.forEach(function (c) {
      if (c.id === card.id) {
        c.tag = c.tag === tag ? null : tag;
      } else if (tag && c.tag === tag) {
        c.tag = null;
      }
    });
    dirty();
    renderCandidates();
    renderAudit();
  }

  function renderCandidates() {
    var root = $("candidates");
    root.innerHTML = "";
    var w = weights();
    state.candidates.forEach(function (c, i) {
      var e = QEQuantum.energyOf(c.scores, w);
      var card = document.createElement("article");
      card.className = "card";
      card.dataset.id = c.id;

      var top = document.createElement("div");
      top.className = "card-top";
      var id = document.createElement("div");
      id.className = "card-id";
      id.textContent = "Reply " + (i + 1);
      var tags = document.createElement("div");
      tags.className = "tags";

      var bRef = document.createElement("button");
      bRef.type = "button";
      bRef.className = "tag";
      bRef.textContent = "reflect-only";
      bRef.setAttribute("aria-pressed", c.tag === "reflect" ? "true" : "false");
      bRef.addEventListener("click", function () {
        setTag(c, "reflect");
      });

      var bWait = document.createElement("button");
      bWait.type = "button";
      bWait.className = "tag wait";
      bWait.textContent = "no / wait / ignore";
      bWait.setAttribute("aria-pressed", c.tag === "wait" ? "true" : "false");
      bWait.addEventListener("click", function () {
        setTag(c, "wait");
      });

      tags.appendChild(bRef);
      tags.appendChild(bWait);
      if (state.candidates.length > 4) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "tag";
        rm.textContent = "remove";
        rm.addEventListener("click", function () {
          state.candidates = state.candidates.filter(function (x) {
            return x.id !== c.id;
          });
          dirty();
          renderCandidates();
          renderAudit();
        });
        tags.appendChild(rm);
      }
      top.appendChild(id);
      top.appendChild(tags);

      var ta = document.createElement("textarea");
      ta.setAttribute("aria-label", "Reply " + (i + 1) + " text");
      ta.placeholder =
        i === 0
          ? "Sendable reply. Ordinary language."
          : "Another sendable reply.";
      ta.value = c.text;
      ta.addEventListener("input", function () {
        c.text = ta.value;
        dirty();
        renderAudit();
      });

      var scores = document.createElement("div");
      scores.className = "scores";
      AXES.forEach(function (axis) {
        var row = document.createElement("div");
        row.className = "axis";
        var name = document.createElement("div");
        name.className = "axis-name";
        name.textContent = axis;
        name.title = AXIS_HINT[axis];
        var stepper = document.createElement("div");
        stepper.className = "stepper";
        stepper.setAttribute("role", "group");
        stepper.setAttribute("aria-label", "Reply " + (i + 1) + " " + axis);
        for (var v = 0; v <= 5; v++) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = String(v);
          btn.setAttribute("aria-pressed", c.scores[axis] === v ? "true" : "false");
          btn.addEventListener("click", function (val) {
            return function () {
              c.scores[axis] = val;
              dirty();
              renderCandidates();
              renderAudit();
            };
          }(v));
          stepper.appendChild(btn);
        }
        row.appendChild(name);
        row.appendChild(stepper);
        scores.appendChild(row);
      });

      var en = document.createElement("div");
      en.className = "energy-line";
      en.textContent = "E = " + e.toFixed(3);

      if (QEHeuristic.looksLikeDraftOrPrompt(c.text) && !$("asked-draft").checked) {
        var warn = document.createElement("p");
        warn.className = "err";
        warn.textContent =
          "This reads like a draft or prompt. Incoming is not marked as asking for one — it cannot collapse.";
        card.appendChild(top);
        card.appendChild(ta);
        card.appendChild(warn);
        card.appendChild(scores);
        card.appendChild(en);
      } else {
        card.appendChild(top);
        card.appendChild(ta);
        card.appendChild(scores);
        card.appendChild(en);
      }

      if (c.tag === "reflect" && analysis().showedPrideOrWork) {
        var hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent =
          "Reflect is the intended ground state unless truth forbids it.";
        card.appendChild(hint);
      }

      root.appendChild(card);
    });

    $("add-candidate").disabled = state.candidates.length >= 6;
    $("slot-note").textContent =
      state.candidates.length + " slots · 4 required · 6 maximum";
  }

  function renderAudit() {
    var a = audit();
    var ul = $("audit-list");
    ul.innerHTML = "";
    a.items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = item.ok ? "ok" : "bad";
      li.textContent = (item.ok ? "Ready — " : "Open — ") + item.label;
      ul.appendChild(li);
    });
    $("run-interfere").disabled = !a.ready;
    $("interfere-lock").textContent = a.ready
      ? state.dirty
        ? "Scores or text changed. Run interference again before collapse."
        : "Audit complete. Interference is current."
      : "Interference stays locked until the audit list is green.";
    updateMeasureGate();
  }

  function dirty() {
    state.dirty = true;
    state.result = null;
    $("interfere-results").hidden = true;
    if (state.collapsed) {
      state.collapsed = null;
      $("collapse-box").hidden = true;
      $("copy-out").disabled = true;
    }
  }

  function recommendedIndex(result) {
    if (result.disagree) return result.classical.index;
    return result.qaoaMode;
  }

  function plainReason(cand, scores) {
    var ranked = AXES.slice().sort(function (a, b) {
      return scores[b] - scores[a];
    });
    var high = ranked.filter(function (k) {
      return scores[k] >= 4;
    });
    var low = ranked.filter(function (k) {
      return scores[k] <= 1;
    });
    var bits = [];
    if (cand.tag === "wait") {
      return "You bought time. No reply goes out.";
    }
    if (cand.tag === "reflect") {
      bits.push("acknowledgment of what they already brought");
    }
    if (high.length) {
      bits.push("strength on " + high.slice(0, 2).join(" and "));
    } else {
      bits.push("a modest fit, strongest on " + ranked[0]);
    }
    if (low.length && low[0] !== ranked[0]) {
      bits.push("and you accepted a weaker " + low[0] + " score");
    }
    var s = "You bought " + bits.join(", ") + ".";
    if (!$("asked-draft").checked) {
      s += " No draft was added, because they did not ask for one.";
    }
    return s;
  }

  function runInterfere() {
    var a = audit();
    if (!a.ready) return;
    var w = weights();
    var list = a.list;
    var energies = list.map(function (c) {
      return QEQuantum.energyOf(c.scores, w);
    });
    var p = parseInt($("qaoa-p").value, 10) === 1 ? 1 : 2;
    var result = QEQuantum.interfere(energies, { p: p, shots: 1024 });
    result.list = list;
    state.result = result;
    state.dirty = false;
    renderInterfere();
    updateMeasureGate();
  }

  function bitLabel(i) {
    return "Reply " + (i + 1);
  }

  function preview(text) {
    var t = text.replace(/\s+/g, " ").trim();
    return t.length > 42 ? t.slice(0, 41) + "…" : t;
  }

  function renderInterfere() {
    var r = state.result;
    var box = $("interfere-results");
    box.hidden = !r;
    if (!r) return;

    var rec = recommendedIndex(r);
    var win = r.list[r.classical.index];
    $("classical-line").textContent =
      bitLabel(indexInAll(win)) +
      "  ·  E = " +
      r.classical.energy.toFixed(3) +
      "  ·  “" +
      preview(win.text) +
      "”  ·  rotor C(two replies) = " +
      r.twoHotCost.toFixed(3) +
      " (illegal, high)";

    var dis = $("disagree-line");
    if (r.disagree) {
      dis.hidden = false;
      var q = r.list[r.qaoaMode];
      dis.textContent =
        "QAOA shot-mode is " +
        bitLabel(indexInAll(q)) +
        "; classical one-hot minimum is " +
        bitLabel(indexInAll(win)) +
        ". Recommended collapse is the classical winner. The histogram is a distribution, not a personality.";
    } else {
      dis.hidden = true;
    }

    var hist = $("histogram");
    hist.innerHTML = "";
    var max = Math.max.apply(null, r.replyCounts.concat([r.invalidShots, 1]));
    r.list.forEach(function (c, i) {
      hist.appendChild(
        barRow(
          bitLabel(indexInAll(c)),
          r.replyCounts[i],
          max,
          i === rec,
          false
        )
      );
    });
    if (r.invalidShots) {
      hist.appendChild(
        barRow("off one-hot", r.invalidShots, max, false, true)
      );
    }

    var tb = $("energy-table").querySelector("tbody");
    tb.innerHTML = "";
    r.list.forEach(function (c, i) {
      var tr = document.createElement("tr");
      if (i === r.classical.index) tr.className = "win";
      var tag = c.tag === "reflect" ? "reflect-only" : c.tag === "wait" ? "no/wait/ignore" : "—";
      [
        bitLabel(indexInAll(c)),
        r.energies[i].toFixed(3),
        r.energies[i].toFixed(3),
        String(r.replyCounts[i]),
        tag,
      ].forEach(function (val) {
        var td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function barRow(label, n, max, win, invalid) {
    var row = document.createElement("div");
    row.className = "bar-row" + (win ? " win" : "") + (invalid ? " invalid" : "");
    var lab = document.createElement("div");
    lab.textContent = label;
    var track = document.createElement("div");
    track.className = "bar-track";
    var fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = ((100 * n) / max).toFixed(1) + "%";
    track.appendChild(fill);
    var num = document.createElement("div");
    num.className = "bar-n";
    num.textContent = n + " / 1024";
    row.appendChild(lab);
    row.appendChild(track);
    row.appendChild(num);
    return row;
  }

  function indexInAll(cand) {
    for (var i = 0; i < state.candidates.length; i++) {
      if (state.candidates[i].id === cand.id) return i;
    }
    return 0;
  }

  function updateMeasureGate() {
    var a = audit();
    var on = a.ready && state.result && !state.dirty;
    $("confirm-collapse").disabled = !on;
    $("measure-lock").textContent = on
      ? "Audit complete. Interference is current. Collapse still waits for your yes."
      : "Confirm stays disabled until audit is complete and interference has been run on the current scores.";
  }

  function collapse() {
    var err = $("measure-err");
    err.hidden = true;
    if (!state.result || state.dirty) return;
    var rec = recommendedIndex(state.result);
    var cand = state.result.list[rec];
    if (!$("asked-draft").checked && QEHeuristic.looksLikeDraftOrPrompt(cand.text)) {
      err.hidden = false;
      err.textContent =
        "Recommended reply looks like a draft or prompt, and incoming was not marked as asking for one. Edit that candidate or check the draft box if they asked.";
      return;
    }
    var reason = plainReason(cand, cand.scores);
    state.collapsed = { text: cand.text.trim(), reason: reason };
    $("out-reply").textContent = state.collapsed.text;
    $("out-reason").textContent = "Reason: " + reason;
    $("collapse-box").hidden = false;
    $("copy-out").disabled = false;
  }

  function copyOut() {
    if (!state.collapsed) return;
    var blob = state.collapsed.text + "\nReason: " + state.collapsed.reason;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(blob).then(
        function () {
          $("copy-out").textContent = "Copied";
          setTimeout(function () {
            $("copy-out").textContent = "Copy";
          }, 1200);
        },
        fallbackCopy
      );
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      var ta = document.createElement("textarea");
      ta.value = blob;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function syncChannelFriend() {
    if ($("channel").value === "friend DM") {
      $("friend-mode").checked = true;
    }
    renderWeights();
    dirty();
    renderCandidates();
    renderAudit();
  }

  function bind() {
    ["ciphertext", "relationship"].forEach(function (id) {
      $(id).addEventListener("input", function () {
        renderRestate();
        dirty();
        renderAudit();
        renderCandidates();
      });
    });
    $("channel").addEventListener("change", function () {
      syncChannelFriend();
      renderRestate();
    });
    $("friend-mode").addEventListener("change", function () {
      renderWeights();
      dirty();
      renderCandidates();
      renderAudit();
    });
    $("asked-draft").addEventListener("change", function () {
      dirty();
      renderCandidates();
      renderAudit();
    });
    $("qaoa-p").addEventListener("change", function () {
      dirty();
      renderAudit();
    });
    $("add-candidate").addEventListener("click", function () {
      if (state.candidates.length >= 6) return;
      state.candidates.push(blank(state.candidates.length));
      dirty();
      renderCandidates();
      renderAudit();
    });
    $("run-interfere").addEventListener("click", runInterfere);
    $("confirm-collapse").addEventListener("click", collapse);
    $("copy-out").addEventListener("click", copyOut);
    $("reset-out").addEventListener("click", function () {
      state.collapsed = null;
      $("collapse-box").hidden = true;
      $("copy-out").disabled = true;
      $("measure-err").hidden = true;
    });
  }

  bind();
  renderRestate();
  renderWeights();
  renderCandidates();
  renderAudit();
})();
