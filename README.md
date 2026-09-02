# QUANTUM ENIGMA

**Fires Vanguard Group — audit-then-execute**

A self-contained static instrument for choosing **one** reply to an incoming message. Incoming text is treated as ciphertext. Candidate replies are basis states. You do not speak until a human confirms collapse.

No accounts. No backend. No LLM. No claimed quantum hardware.

## What it is

A four-stage protocol:

1. **Prepare** — paste the incoming message, note relationship and channel. The app restates the ask in one sentence and lists what was *not* asked (client-side heuristic only; it does not invent facts).
2. **Score (Hamiltonian)** — 4–6 sendable replies. Tag one **reflect-only** and one **no / wait / ignore**. Score each on truth, outcome, restraint, mission, and risk (0–5). You may write them, or let the app draft and score.
3. **Interfere** — classical one-hot minimum of the QUBO, plus a shallow-p QAOA simulator in JavaScript (n = 4…6). Histogram over replies. Always: *No quantum advantage claimed.*
4. **Measure** — Confirm / Collapse is disabled until audit is complete. On confirm, the app outputs **only** the winning reply and a plain-language `Reason:` line. Copy to clipboard. Nothing is sent.

If QAOA shot-mode disagrees with the classical winner, the **classical** winner is the recommended collapse.

## Draft / score / recommend

After Prepare, **Draft, score, and recommend** is one click:

1. **Write** 5 or 6 sendable replies from this ciphertext, relationship, and channel. The restatement heuristic is the spine (restated ask, unasked list, pride/work, draft-asked). Required slots: one **reflect-only**, one **no / wait / ignore**. The others are distinct legal moves — a direct answer that uses only facts already in the incoming text, a clarifying question, a boundary / deferral, and a wording draft **only** if they asked for a prompt or draft.
2. **Score** each reply 0–5 on truth, outcome, restraint, mission, and risk, with a one-line why per axis. You can edit any draft or score before confirm.
3. **Recommend** by running the existing Hamiltonian + QAOA interfere step. The classical one-hot winner is marked **Recommended to send**. If QAOA disagrees, the note stays and the recommendation stays classical. No quantum advantage claimed.

Collapse still requires a human **Confirm**. Nothing is sent anywhere. Qubit count still does not choose the words.

Drafts are ordinary language, first person as the person answering, matched to channel (friend DM warmer, command thread tighter, public post more careful). They quote or paraphrase the incoming words. No `[name]` placeholders, no invented ranges, programs, dates, or a CRQC. If the ask cannot be answered from the ciphertext, the direct-answer state says so or waits.

If they showed work or pride, the reflect-only state is the intended ground state unless a truth conflict is obvious (invented praise of facts not in the text).

## How to use

1. Open `index.html` (or serve the folder — see below).
2. Paste the incoming message. Set relationship and channel. Friend DM turns on friend-thread weights.
3. Check **Incoming asked for a draft or prompt** only if they actually asked — or let **Draft, score, and recommend** set it from the heuristic. If they did not ask, a candidate that reads like a draft cannot collapse.
4. Click **Draft, score, and recommend**, or write at least four replies yourself. Tag reflect-only and no/wait/ignore. Score the axes (or accept the auto-scores and edit).
5. Read the classical winner, the **Recommended to send** mark, and the histogram. Re-run interference if you edit.
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
| `js/heuristic.js` | Ask restatement, unasked-list, and incoming parse |
| `js/draft.js` | Client-side draft + score (no LLM) |
| `js/qubo-qaoa.js` | Weights, QUBO, QAOA simulator |
| `js/app.js` | Audit gates, draft/score/recommend, interfere, collapse |
| `LICENSE` | MIT |

## Hard rules

- Never invent facts, ranges, programs, or a CRQC.
- The app may draft and score. Qubit count still does not choose the words. You confirm collapse.
- If they did not ask for a prompt or draft, the winning state must not contain one.
- The enigma is the scoring and the collapse. The reply is ordinary language.

## License

MIT. See `LICENSE`.
