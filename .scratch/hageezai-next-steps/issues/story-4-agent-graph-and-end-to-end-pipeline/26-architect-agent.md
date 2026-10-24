# 26 — Architect agent

**What to build:** An `architect` Agent reads the analysis and product brief and produces a design artifact with the system shape, components, data flow, interfaces, and key trade-offs, plus draft architecture decisions. Project ADRs reach the repository only through the Build Agent's approval gate so the single-writer rule is preserved.

**Blocked by:** 21 — Analyst agent; 25 — Product-brief agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16b.

- [ ] The Agent consumes both the analysis and brief artifacts.
- [ ] It writes a `design` artifact covering components, interfaces, data flow, and trade-offs.
- [ ] It produces draft ADRs as artifacts, marked draft, without bypassing the approval gate.
- [ ] Any project ADR file is written only by the Build Agent after approval.
- [ ] It writes artifacts only and runs through the orchestrator.
- [ ] Tests cover design structure, draft ADRs, and the single-writer boundary.
