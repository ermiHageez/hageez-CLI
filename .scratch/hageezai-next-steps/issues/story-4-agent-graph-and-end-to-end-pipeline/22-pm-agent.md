# 22 — PM agent

**What to build:** The existing planner becomes the `pm` Agent, consuming the analysis artifact and producing a plan artifact with an ordered task list and dependencies. The Agent runs through the orchestrator and does not write project files.

**Blocked by:** 21 — Analyst agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 15b.

- [ ] The `pm` Agent wraps the existing planner rather than reimplementing planning.
- [ ] It consumes the analyst artifact and writes a `plan` artifact with tasks and dependencies.
- [ ] It runs through the orchestrator, writes artifacts only, and never writes project files.
- [ ] The Agent has a system prompt, declared inputs and outputs, and one test.
- [ ] Tests cover a plan produced from upstream analysis and the artifact contract.
