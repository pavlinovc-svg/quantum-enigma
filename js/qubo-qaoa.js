/**
 * QUANTUM ENIGMA — QUBO mapping and shallow-p QAOA simulator
 *
 * This is a classical JavaScript simulator of a tiny quantum circuit.
 * n = 4..6 qubits ⇒ 16..64 amplitudes. No hardware. No advantage claimed.
 *
 * ---------------------------------------------------------------------------
 * QUBO / one-hot (the rotor)
 * ---------------------------------------------------------------------------
 * One qubit x_i ∈ {0,1} per candidate reply i.
 * Exactly one reply may be selected: Hamming weight 1.
 *
 * Diagonal cost (energy of bitstring x):
 *
 *   C(x) = Σ_i E_i x_i
 *        + P  Σ_{i<j} x_i x_j          // pairwise: two replies = high energy
 *        + λ (Σ_i x_i − 1)²            // optional HW≠1 penalty (includes |0…0⟩)
 *
 * Hamiltonian is diagonal in the reply / computational basis:
 *   H_C |x⟩ = C(x) |x⟩
 *
 * Candidate energies (also diagonal):
 *   E_i = −( w_t·truth + w_o·outcome + w_r·restraint + w_m·mission + w_k·risk )
 * Scores are integers 0–5 entered by the human.
 *
 * Default weights:     0.30, 0.25, 0.20, 0.15, 0.10
 * Friend-thread mode:  restraint → 0.35, mission → 0.05;
 *                      remaining weights renormalized so Σw = 1.
 *
 * ---------------------------------------------------------------------------
 * QAOA (p = 1 or 2) on the one-hot subspace
 * ---------------------------------------------------------------------------
 * Legal replies are the n one-hot strings |e_i⟩. The pairwise / HW penalties
 * are the rotor: they make every other Hamming weight expensive, which is why
 * a constraint-preserving mixer is the honest shallow-p circuit for this QUBO.
 *
 * Initial state: |W⟩ = n^{−1/2} Σ_i |e_i⟩
 * Cost on this subspace: H_C |e_i⟩ = E_i |e_i⟩   (penalties do not fire)
 * Mixer: complete XY  H_M = Σ_{i<j} (X_i X_j + Y_i Y_j)/2
 *      which, on one-hot states, is the matrix  11ᵀ − I
 *      (eigenvalue n−1 on |W⟩, eigenvalue −1 on W⊥).
 *
 * Circuit:
 *   U(γ,β) = Π_{ℓ=1}^{p}  e^{−i β_ℓ H_M} e^{−i γ_ℓ H_C}
 *
 * Parameters (γ,β) are chosen by a coarse grid search that minimizes ⟨C⟩.
 * Shots are sampled from the resulting |amplitude|². Histogram ≠ personality.
 */
(function (global) {
  "use strict";

  var DEFAULT_WEIGHTS = {
    truth: 0.3,
    outcome: 0.25,
    restraint: 0.2,
    mission: 0.15,
    risk: 0.1,
  };

  /** Pairwise one-hot rotor. Large enough that any two-hot beats any legal E_i. */
  var PAIR_PENALTY = 12;
  /** Extra (hw − 1)² so the vacuum |0…0⟩ is not competitive with E_i ∈ [−5, 0]. */
  var HW_PENALTY = 8;

  function friendWeights() {
    var restDefault =
      DEFAULT_WEIGHTS.truth + DEFAULT_WEIGHTS.outcome + DEFAULT_WEIGHTS.risk;
    var restTarget = 1 - 0.35 - 0.05;
    var scale = restTarget / restDefault;
    return {
      truth: DEFAULT_WEIGHTS.truth * scale,
      outcome: DEFAULT_WEIGHTS.outcome * scale,
      restraint: 0.35,
      mission: 0.05,
      risk: DEFAULT_WEIGHTS.risk * scale,
    };
  }

  function weightsFor(friendMode) {
    return friendMode ? friendWeights() : Object.assign({}, DEFAULT_WEIGHTS);
  }

  function energyOf(scores, weights) {
    var s =
      weights.truth * (scores.truth || 0) +
      weights.outcome * (scores.outcome || 0) +
      weights.restraint * (scores.restraint || 0) +
      weights.mission * (scores.mission || 0) +
      weights.risk * (scores.risk || 0);
    return -s;
  }

  function bit(x, i) {
    return (x >>> i) & 1;
  }

  /**
   * C(x) as written above.
   * Legal one-hot strings evaluate to exactly E_i of the selected candidate.
   */
  function costOf(x, energies) {
    var n = energies.length;
    var linear = 0;
    var pairs = 0;
    var hw = 0;
    for (var i = 0; i < n; i++) {
      if (bit(x, i)) {
        linear += energies[i];
        hw += 1;
        for (var j = i + 1; j < n; j++) {
          if (bit(x, j)) pairs += 1;
        }
      }
    }
    var hwTerm = (hw - 1) * (hw - 1);
    return linear + PAIR_PENALTY * pairs + HW_PENALTY * hwTerm;
  }

  function classicalWinner(energies) {
    var n = energies.length;
    var bestI = 0;
    var bestC = energies[0];
    var table = [];
    for (var i = 0; i < n; i++) {
      var x = 1 << i;
      var c = costOf(x, energies);
      table.push({ index: i, bitstring: x, cost: c, energy: energies[i] });
      if (c < bestC - 1e-12 || (Math.abs(c - bestC) < 1e-12 && i < bestI)) {
        bestC = c;
        bestI = i;
      }
    }
    return { index: bestI, cost: bestC, energy: energies[bestI], table: table };
  }

  /* ---- one-hot subspace state (n amplitudes, not 2^n) ---------------------- */

  function applyCost(re, im, energies, gamma) {
    var n = energies.length;
    for (var i = 0; i < n; i++) {
      var theta = -gamma * energies[i];
      var cr = Math.cos(theta);
      var ci = Math.sin(theta);
      var r = re[i];
      var q = im[i];
      re[i] = r * cr - q * ci;
      im[i] = r * ci + q * cr;
    }
  }

  /**
   * Exact e^{−i β (11ᵀ − I)} on the one-hot subspace.
   * |W⟩ picks up e^{−i β (n−1)}; W⊥ picks up e^{i β}.
   */
  function applyMixer(re, im, beta) {
    var n = re.length;
    var inv = 1 / Math.sqrt(n);
    var wRe = 0;
    var wIm = 0;
    var i;
    for (i = 0; i < n; i++) {
      wRe += re[i];
      wIm += im[i];
    }
    wRe *= inv;
    wIm *= inv;
    var thW = -beta * (n - 1);
    var cW = Math.cos(thW);
    var sW = Math.sin(thW);
    var cP = Math.cos(beta);
    var sP = Math.sin(beta);
    for (i = 0; i < n; i++) {
      var projRe = wRe * inv;
      var projIm = wIm * inv;
      var pRe = re[i] - projRe;
      var pIm = im[i] - projIm;
      re[i] = cW * projRe - sW * projIm + cP * pRe - sP * pIm;
      im[i] = cW * projIm + sW * projRe + cP * pIm + sP * pRe;
    }
  }

  function wState(n) {
    var amp = 1 / Math.sqrt(n);
    var re = new Float64Array(n);
    var im = new Float64Array(n);
    for (var i = 0; i < n; i++) re[i] = amp;
    return { re: re, im: im };
  }

  function runQaoa(energies, gammas, betas) {
    var st = wState(energies.length);
    for (var l = 0; l < gammas.length; l++) {
      applyCost(st.re, st.im, energies, gammas[l]);
      applyMixer(st.re, st.im, betas[l]);
    }
    return st;
  }

  function expectation(st, energies) {
    var e = 0;
    var norm = 0;
    for (var i = 0; i < st.re.length; i++) {
      var p = st.re[i] * st.re[i] + st.im[i] * st.im[i];
      e += p * energies[i];
      norm += p;
    }
    return e / (norm || 1);
  }

  function norm2(st) {
    var s = 0;
    for (var i = 0; i < st.re.length; i++) {
      s += st.re[i] * st.re[i] + st.im[i] * st.im[i];
    }
    return s;
  }

  function probabilities(st) {
    var n = st.re.length;
    var p = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      p[i] = st.re[i] * st.re[i] + st.im[i] * st.im[i];
    }
    return p;
  }

  function sampleShots(prob, shots, rng) {
    var n = prob.length;
    var cdf = new Float64Array(n);
    var acc = 0;
    for (var i = 0; i < n; i++) {
      acc += prob[i];
      cdf[i] = acc;
    }
    if (acc <= 0) acc = 1;
    var counts = new Uint32Array(n);
    for (var s = 0; s < shots; s++) {
      var u = (rng ? rng() : Math.random()) * acc;
      var lo = 0;
      var hi = n - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (u <= cdf[mid]) hi = mid;
        else lo = mid + 1;
      }
      counts[lo] += 1;
    }
    return counts;
  }

  function grid1() {
    var g = [];
    var b = [];
    var i;
    for (i = 1; i <= 10; i++) g.push((i * Math.PI) / 10);
    for (i = 1; i <= 8; i++) b.push((i * Math.PI) / 16);
    return { g: g, b: b };
  }

  /**
   * Coarse variational search. p=1: full grid. p=2: best layer-1 + second-layer grid.
   * Good enough for n≤6; this is a simulator, not a claim.
   */
  function optimizeParams(energies, p) {
    var grid = grid1();
    var best = { exp: Infinity, gammas: [0.8], betas: [0.4] };
    var gi, bi, st, exp;

    for (gi = 0; gi < grid.g.length; gi++) {
      for (bi = 0; bi < grid.b.length; bi++) {
        st = runQaoa(energies, [grid.g[gi]], [grid.b[bi]]);
        exp = expectation(st, energies);
        if (exp < best.exp) {
          best = { exp: exp, gammas: [grid.g[gi]], betas: [grid.b[bi]] };
        }
      }
    }

    if (p < 2) return best;

    var g0 = best.gammas[0];
    var b0 = best.betas[0];
    best = { exp: Infinity, gammas: [g0, g0], betas: [b0, b0] };
    for (gi = 0; gi < grid.g.length; gi++) {
      for (bi = 0; bi < grid.b.length; bi++) {
        st = runQaoa(energies, [g0, grid.g[gi]], [b0, grid.b[bi]]);
        exp = expectation(st, energies);
        if (exp < best.exp) {
          best = {
            exp: exp,
            gammas: [g0, grid.g[gi]],
            betas: [b0, grid.b[bi]],
          };
        }
      }
    }
    return best;
  }

  function interfere(energies, opts) {
    opts = opts || {};
    var p = opts.p === 1 ? 1 : 2;
    var shots = opts.shots || 1024;
    var n = energies.length;
    if (n < 2 || n > 8) {
      throw new Error("QAOA simulator expects 2–8 candidates.");
    }

    var classic = classicalWinner(energies);
    var params = optimizeParams(energies, p);
    var st = runQaoa(energies, params.gammas, params.betas);
    var prob = probabilities(st);
    var counts = sampleShots(prob, shots);

    var replyCounts = [];
    var modeI = 0;
    var modeC = 0;
    var i;
    for (i = 0; i < n; i++) {
      replyCounts.push(counts[i]);
      if (counts[i] > modeC) {
        modeC = counts[i];
        modeI = i;
      }
    }

    var twoHot = n >= 2 ? costOf(3, energies) : 0;

    return {
      n: n,
      p: p,
      shots: shots,
      energies: energies.slice(),
      classical: classic,
      qaoaMode: modeI,
      disagree: modeI !== classic.index,
      params: params,
      replyCounts: replyCounts,
      invalidShots: 0,
      replyProbExact: Array.prototype.slice.call(prob),
      expectation: params.exp,
      norm: norm2(st),
      pairPenalty: PAIR_PENALTY,
      hwPenalty: HW_PENALTY,
      twoHotCost: twoHot,
    };
  }

  global.QEQuantum = {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    PAIR_PENALTY: PAIR_PENALTY,
    HW_PENALTY: HW_PENALTY,
    weightsFor: weightsFor,
    energyOf: energyOf,
    costOf: costOf,
    classicalWinner: classicalWinner,
    interfere: interfere,
  };
})(window);
