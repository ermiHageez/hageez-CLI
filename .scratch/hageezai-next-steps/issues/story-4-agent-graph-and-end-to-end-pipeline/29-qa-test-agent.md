# 29 — QA test agent

**What to build:** A `qa-tests` Agent generates tests for the Build, detects the project's test command, runs it, and reports pass or fail with useful output. Generated test files reach the project only through the approved Build path, preserving the single-writer rule.

**Blocked by:** 23 — Build agent; 01 — Test harness and CI.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 16e.

- [x] The Agent generates tests that target the Task and the resulting changes.
- [x] It detects the project's test command instead of assuming one.
- [x] It runs the tests and reports pass or fail with the failing output.
- [x] Generated tests are written to the project only through the Build Agent's approval gate.
- [x] A missing or unknown test command is reported clearly rather than treated as a pass.
- [x] Tests cover detection, generation, pass, fail, and the no-command case.
