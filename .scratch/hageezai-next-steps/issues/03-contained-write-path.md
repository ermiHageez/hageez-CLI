# 03 — Contained write path and truthful write claim

**What to build:** A Build can no longer write or delete outside its project, through a symlink, or inside protected directories, and the CLI describes direct writes honestly. If any target in a batch is unsafe, the whole batch is rejected and no file changes.

**Blocked by:** 01 — Test harness and CI.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 2.

- [ ] Paths escaping the project, absolute paths outside it, `.git`, `node_modules`, and symlink escapes are rejected.
- [ ] Relative paths and absolute paths that resolve inside the project remain valid.
- [ ] Every path in a batch is validated before the first write or delete; one invalid path leaves the project unchanged.
- [ ] Errors name the offending relative path and never include file contents.
- [ ] Startup and dashboard no longer claim a sandbox and instead say `Writes: direct (review changes with git)`.
- [ ] Tests cover traversal, outside absolute paths, protected segments, valid inside paths, and symlink escape where supported.
