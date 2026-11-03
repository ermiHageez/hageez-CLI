# 17 — Artifact store

**What to build:** Each Run stores every Agent output as a readable artifact under the project's `ai-learning` area, together with a manifest of inputs, outputs, statuses, timestamps, and models. Agents read upstream artifacts rather than chat history, and bad paths or partial writes cannot corrupt a Run.

**Blocked by:** 15 — Agent runtime.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 11.

- [x] Each Agent output is written to the Run's artifact directory with a manifest recording inputs, outputs, status, timestamps, and model.
- [x] Writing, reading, and listing artifacts work for a Run.
- [x] Artifact paths are validated and writes are atomic; a failure leaves no partial artifact.
- [x] A second Agent in the same Run reads the first Agent's artifact as input.
- [x] No Agent receives prior chat history as a substitute for an upstream artifact.
- [x] Tests cover manifest contents, path rejection, atomic failure, and sequential reads.
