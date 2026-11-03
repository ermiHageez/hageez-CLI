# 30 — Retrospective agent

**What to build:** A `retrospective` Agent reads the Run manifest and Session Log, then writes at least one Decision and any candidate Skills to project Memory. Those records are available to the next Run, closing the learning loop without writing project files.

**Blocked by:** 24 — Code-review agent; 29 — QA test agent; 19 — Memory recall.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 16f.

- [x] The Agent reads the Run manifest and Session Log.
- [x] It writes at least one Decision and zero or more candidate Skills to project Memory.
- [x] It records only metadata and outcomes, never file contents or secrets.
- [x] It performs no project file writes.
- [x] The next Run recalls the new Decision.
- [x] Tests cover a successful retrospective, Memory persistence, and the no-learning case.
