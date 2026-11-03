# 21 — Analyst agent

**What to build:** The existing project scan and request-understanding step becomes the `analyst` Agent, running through the orchestrator and producing a requirements and MVP-scope artifact. The observable behaviour of `hageez build` stays the same during this port.

**Blocked by:** 18 — Orchestrator.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 15a.

- [x] The `analyst` Agent wraps the existing scanner and intent step without duplicating their logic.
- [x] It runs through the orchestrator and writes an `analysis` artifact containing requirements and MVP scope.
- [x] `hageez build` continues to behave as before until later Agents are ported.
- [x] The Agent has a system prompt, declared inputs and outputs, and one test.
- [x] Tests cover a successful analysis run and the artifact contract.
