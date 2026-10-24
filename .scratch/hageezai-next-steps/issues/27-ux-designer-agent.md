# 27 — UX designer agent

**What to build:** A `ux-designer` Agent runs only when the project uses a frontend framework or the Task mentions UI, and produces a UX artifact describing screens, states, flows, and accessibility expectations. When the trigger is absent, the Agent is skipped without failing the Run.

**Blocked by:** 21 — Analyst agent; 25 — Product-brief agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16c.

- [ ] The frontend/UI trigger is detected from the project scan or the Task.
- [ ] When triggered, the Agent consumes the analysis and brief and writes a UX artifact with screens, states, flows, and accessibility notes.
- [ ] When not triggered, the Agent is recorded as skipped and the Run continues.
- [ ] It writes artifacts only and runs through the orchestrator.
- [ ] Tests cover triggered, skipped, and malformed-trigger cases.
