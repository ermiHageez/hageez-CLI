# 01 — Test harness and CI

**What to build:** A maintainer can run one command to compile and execute the automated test suite, and CI runs the same checks on Node 22.12. The harness uses `node:test`, adds no runtime dependency, and keeps test output out of the shipped build.

**Blocked by:** None — can start immediately.

**Status:** resolved

**Covers:** NEXT_STEPS Step 8, test-harness portion.

- [x] `npm test` compiles the tests separately and runs them with `node:test`.
- [x] `npm run lint` type-checks both the shipped source and the tests.
- [x] CI installs from the lockfile, then runs lint, build, and test on Node 22.12.
- [x] Compiled test output is excluded from version control.
- [x] Initial smoke tests exercise existing public behaviour without changing runtime behaviour.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
