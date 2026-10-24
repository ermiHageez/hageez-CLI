# 29 — QA test agent

**What to build:** A `qa-tests` Agent generates tests for the Build, detects the project's test command, runs it, and reports pass or fail with useful output. Generated test files reach the project only through the approved Build path, preserving the single-writer rule.

**Blocked by:** 23 — Build agent; 01 — Test harness and CI.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16e.

- [ ] The Agent generates tests that target the Task and the resulting changes.
- [ ] It detects the project's test command instead of assuming one.
- [ ] It runs the tests and reports pass or fail with the failing output.
- [ ] Generated tests are written to the project only through the Build Agent's approval gate.
- [ ] A missing or unknown test command is reported clearly rather than treated as a pass.
- [ ] Tests cover detection, generation, pass, fail, and the no-command case.
