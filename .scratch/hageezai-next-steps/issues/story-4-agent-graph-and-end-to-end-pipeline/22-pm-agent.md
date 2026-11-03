# 22 — PM agent

**What to build:** The existing planner becomes the `pm` Agent, consuming the analysis artifact and producing a plan artifact with an ordered task list and dependencies. The Agent runs through the orchestrator and does not write project files.

**Blocked by:** 21 — Analyst agent.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 15b.

- [x] The `pm` Agent wraps the existing planner rather than reimplementing planning.
- [x] It consumes the analyst artifact and writes a `plan` artifact with tasks and dependencies.
- [x] It runs through the orchestrator, writes artifacts only, and never writes project files.
- [x] The Agent has a system prompt, declared inputs and outputs, and one test.
- [x] Tests cover a plan produced from upstream analysis and the artifact contract.
