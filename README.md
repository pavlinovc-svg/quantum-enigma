# QUANTUM ENIGMA

**Fires Vanguard Group — audit-then-execute**

A self-contained static instrument for choosing **one** reply to an incoming message. Incoming text is treated as ciphertext. Candidate replies are basis states. You do not speak until a human confirms collapse.

No accounts. No backend. No LLM. No claimed quantum hardware.

## What it is

A four-stage protocol:

1. **Prepare** — paste the incoming message, note relationship and channel. The app restates the ask in one sentence and lists what was *not* asked (client-side heuristic only; it does not invent facts).
2. **Score (Hamiltonian)** — write 4–6 sendable replies. Tag one **reflect-only** and one **no / wait / ignore**. Score each on truth, outcome, restraint, mission, and risk (0–5).
3. **Interfere** — classical one-hot minimum of the QUBO, plus a shallow-p QAOA simulator in JavaScript (n = 4…6). Histogram over replies. Always: *No quantum advantage claimed.*
4. **Measure** — Confirm / Collapse is disabled until audit is complete. On confirm, the app outputs **only** the winning reply and a plain-language `Reason:` line. Copy to clipboard. Nothing is sent.

If QAOA shot-mode disagrees with the classical winner, the **classical** winner is the recommended collapse.

## How to use

1. Open `index.html` (or serve the folder — see below).
2. Paste the incoming message. Set relationship and channel. Friend DM turns on friend-thread weights.
3. Check **Incoming asked for a draft or prompt** only if they actually asked. If they did not, a candidate that reads like a draft cannot collapse.
4. Write at least four replies. Tag reflect-only and no/wait/ignore. Score the axes.
5. Run interference. Read the classical winner and the histogram.
6. Press **Confirm / collapse** only when you mean to choose. Copy the ordinary-language output if you will send it yourself.

If the incoming message showed work or pride, the instrument hints that the reflect state is the intended ground state unless truth forbids it.

## Protocol (implemented exactly)

### Hamiltonian

For candidate *i*,

\[
E_i = -(0.3\cdot\text{truth} + 0.25\cdot\text{outcome} + 0.20\cdot\text{restraint} + 0.15\cdot\text{mission} + 0.10\cdot\text{risk})
\]

**Friend-thread mode:** restraint \(0.35\), mission \(0.05\); the other three weights are renormalized so all five still sum to 1. Default (non-friend) weights are as written.

### QUBO / one-hot

One qubit per candidate. Cost of bitstring \(x\):

\[
C(x)=\sum_i E_i x_i + P\sum_{i<j}x_i x_j + \lambda\Bigl(\sum_i x_i-1\Bigr)^2
\]

One-hot is the constraint. Two replies selected = high energy (the rotor). Mapping and QAOA circuit are commented in `js/qubo-qaoa.js`.

### Interfere

- **Classical:** argmax of \(-E\) among legal one-hot strings (equivalently, min \(C\) on Hamming weight 1).
- **Quantum:** real shallow-p QAOA on this QUBO in the browser (\(p=1\) or \(p=2\)), simulated in the one-hot reply subspace with a complete XY mixer (the pairwise penalty is the rotor that makes that subspace the feasible set). Many shots. Histogram is a distribution, not a personality.
- Line always shown: `No quantum advantage claimed.`

### Measure

Human yes only. Collapsed output is ordinary language — reply text plus `Reason:` from the winning scores, not physics jargon. No circuit explanation in that box.

## How to serve

GitHub Pages, Origin static preview, or any static host: publish the repo root so `index.html` is the site root.

Locally, opening `index.html` in a browser is enough. Clipboard may require a local server on some browsers:

```bash
python3 -m http.server 43217
```

Then open `http://127.0.0.1:43217/`.

A CDN font (IBM Plex) is optional; the layout degrades to system fonts offline.

## Files

| File | Role |
| --- | --- |
| `index.html` | Instrument shell |
| `styles.css` | Command-facing dark UI |
| `js/heuristic.js` | Ask restatement and unasked-list heuristic |
| `js/qubo-qaoa.js` | Weights, QUBO, QAOA simulator |
| `js/app.js` | Audit gates, interfere, collapse |
| `LICENSE` | MIT |

## Hard rules

- Never invent facts, ranges, programs, or a CRQC.
- Never let qubit count choose the words.
- If they did not ask for a prompt or draft, the winning state must not contain one.
- The enigma is the scoring and the collapse. The reply is ordinary language.

## License

MIT. See `LICENSE`.
