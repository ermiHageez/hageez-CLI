# 04 — Safe opencode delegation

**What to build:** `hageez build --via-opencode` delegates to the real `opencode run` command using an argument array, so Task text containing shell metacharacters stays one argument. A missing or failing opencode installation produces a clean product error instead of a shell injection or stack trace.

**Blocked by:** 01 — Test harness and CI.

**Status:** resolved

**Covers:** NEXT_STEPS Step 3.

- [x] Opencode receives the Task as one argv element, never through a shell string.
- [x] A missing executable raises `OPENCODE_NOT_FOUND`; a non-zero run raises `OPENCODE_FAILED`.
- [x] Build prints the error cleanly, sets a failing exit code, and emits no stack trace.
- [x] Project validation uses argument-array execution as well.
- [x] Tests prove a Task containing `; echo hacked` remains a single argument.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
