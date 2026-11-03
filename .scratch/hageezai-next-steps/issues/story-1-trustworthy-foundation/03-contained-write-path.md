# 03 — Contained write path and truthful write claim

**What to build:** A Build can no longer write or delete outside its project, through a symlink, or inside protected directories, and the CLI describes direct writes honestly. If any target in a batch is unsafe, the whole batch is rejected and no file changes.

**Blocked by:** 01 — Test harness and CI.

**Status:** resolved

**Covers:** NEXT_STEPS Step 2.

- [x] Paths escaping the project, absolute paths outside it, `.git`, `node_modules`, and symlink escapes are rejected.
- [x] Relative paths and absolute paths that resolve inside the project remain valid.
- [x] Every path in a batch is validated before the first write or delete; one invalid path leaves the project unchanged.
- [x] Errors name the offending relative path and never include file contents.
- [x] Startup and dashboard no longer claim a sandbox and instead say `Writes: direct (review changes with git)`.
- [x] Tests cover traversal, outside absolute paths, protected segments, valid inside paths, and symlink escape where supported.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
