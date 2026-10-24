# 01 — Test harness and CI

**What to build:** A maintainer can run one command to compile and execute the automated test suite, and CI runs the same checks on Node 22.12. The harness uses `node:test`, adds no runtime dependency, and keeps test output out of the shipped build.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 8, test-harness portion.

- [ ] `npm test` compiles the tests separately and runs them with `node:test`.
- [ ] `npm run lint` type-checks both the shipped source and the tests.
- [ ] CI installs from the lockfile, then runs lint, build, and test on Node 22.12.
- [ ] Compiled test output is excluded from version control.
- [ ] Initial smoke tests exercise existing public behaviour without changing runtime behaviour.
