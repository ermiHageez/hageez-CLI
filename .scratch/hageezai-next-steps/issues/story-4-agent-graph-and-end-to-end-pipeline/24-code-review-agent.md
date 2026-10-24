# 24 — Code-review agent

**What to build:** The existing reviewer becomes the `code-review` Agent and reviews the actual diff produced by the Build, including newly created files. It writes a review artifact with structured issues, and high-severity issues are sent back to the Build for at most two loops.

**Blocked by:** 23 — Build agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 15d.

- [ ] Review reads the actual diff, including new files, rather than a summary or chat history.
- [ ] The review artifact contains structured issues with severity.
- [ ] High-severity issues are consumed by the pipeline and trigger at most two additional Build passes.
- [ ] A clean review finishes without an extra Build pass.
- [ ] The Agent has a system prompt, declared inputs and outputs, and one test.
- [ ] Tests cover new-file detection, structured issues, the loop limit, and a clean result.
