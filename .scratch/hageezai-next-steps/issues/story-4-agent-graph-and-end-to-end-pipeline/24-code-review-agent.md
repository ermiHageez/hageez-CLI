# 24 — Code-review agent

**What to build:** The existing reviewer becomes the `code-review` Agent and reviews the actual diff produced by the Build, including newly created files. It writes a review artifact with structured issues, and high-severity issues are sent back to the Build for at most two loops.

**Blocked by:** 23 — Build agent.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 15d.

- [x] Review reads the actual diff, including new files, rather than a summary or chat history.
- [x] The review artifact contains structured issues with severity.
- [x] High-severity issues are consumed by the pipeline and trigger at most two additional Build passes.
- [x] A clean review finishes without an extra Build pass.
- [x] The Agent has a system prompt, declared inputs and outputs, and one test.
- [x] Tests cover new-file detection, structured issues, the loop limit, and a clean result.
