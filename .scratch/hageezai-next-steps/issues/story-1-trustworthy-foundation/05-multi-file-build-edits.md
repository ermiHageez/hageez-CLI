# 05 — Multi-file Build edits and extension inference

**What to build:** A Task that references several files updates every referenced file in one Build, and a Task without references creates a file with the project's language extension. Every generated code block is required; a missing block retries once and then fails before anything is written.

**Blocked by:** 03 — Contained write path and truthful write claim.

**Status:** resolved

**Covers:** NEXT_STEPS Step 4.

- [x] Three File References produce three file changes, with token usage summed.
- [x] Extraction accepts only fenced code; no block retries once and then raises `NO_CODE_BLOCK`.
- [x] A failed extraction in any referenced file prevents all writes.
- [x] Known project languages map to the agreed extension set; an unknown language asks the model for one valid relative path and rejects an invalid answer.
- [x] The builder accepts an injected model call for deterministic tests while production still uses the normal call.
- [x] Tests cover multi-file updates, retry/failure, extensions, and inferred paths.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
