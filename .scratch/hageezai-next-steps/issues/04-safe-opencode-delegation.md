# 04 — Safe opencode delegation

**What to build:** `hageez build --via-opencode` delegates to the real `opencode run` command using an argument array, so Task text containing shell metacharacters stays one argument. A missing or failing opencode installation produces a clean product error instead of a shell injection or stack trace.

**Blocked by:** 01 — Test harness and CI.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 3.

- [ ] Opencode receives the Task as one argv element, never through a shell string.
- [ ] A missing executable raises `OPENCODE_NOT_FOUND`; a non-zero run raises `OPENCODE_FAILED`.
- [ ] Build prints the error cleanly, sets a failing exit code, and emits no stack trace.
- [ ] Project validation uses argument-array execution as well.
- [ ] Tests prove a Task containing `; echo hacked` remains a single argument.
