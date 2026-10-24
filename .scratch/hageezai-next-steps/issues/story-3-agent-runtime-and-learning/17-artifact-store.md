# 17 — Artifact store

**What to build:** Each Run stores every Agent output as a readable artifact under the project's `ai-learning` area, together with a manifest of inputs, outputs, statuses, timestamps, and models. Agents read upstream artifacts rather than chat history, and bad paths or partial writes cannot corrupt a Run.

**Blocked by:** 15 — Agent runtime.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 11.

- [ ] Each Agent output is written to the Run's artifact directory with a manifest recording inputs, outputs, status, timestamps, and model.
- [ ] Writing, reading, and listing artifacts work for a Run.
- [ ] Artifact paths are validated and writes are atomic; a failure leaves no partial artifact.
- [ ] A second Agent in the same Run reads the first Agent's artifact as input.
- [ ] No Agent receives prior chat history as a substitute for an upstream artifact.
- [ ] Tests cover manifest contents, path rejection, atomic failure, and sequential reads.
