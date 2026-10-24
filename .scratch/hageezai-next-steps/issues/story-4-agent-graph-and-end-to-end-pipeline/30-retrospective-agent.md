# 30 — Retrospective agent

**What to build:** A `retrospective` Agent reads the Run manifest and Session Log, then writes at least one Decision and any candidate Skills to project Memory. Those records are available to the next Run, closing the learning loop without writing project files.

**Blocked by:** 24 — Code-review agent; 29 — QA test agent; 19 — Memory recall.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16f.

- [ ] The Agent reads the Run manifest and Session Log.
- [ ] It writes at least one Decision and zero or more candidate Skills to project Memory.
- [ ] It records only metadata and outcomes, never file contents or secrets.
- [ ] It performs no project file writes.
- [ ] The next Run recalls the new Decision.
- [ ] Tests cover a successful retrospective, Memory persistence, and the no-learning case.
