# 25 — Product-brief agent

**What to build:** The fake `grill` behaviour is replaced by a real `product-brief` Agent that asks Socratic questions about the analysis and then writes a product brief artifact. The user gets a concise brief that later architecture and UX Agents can consume.

**Blocked by:** 21 — Analyst agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16a.

- [ ] The Agent asks Socratic questions grounded in the analysis rather than accepting the first framing.
- [ ] It writes a `brief` artifact describing the problem, users, outcomes, constraints, and non-goals.
- [ ] The fake grill path is no longer reachable.
- [ ] It runs through the orchestrator and writes artifacts only.
- [ ] Tests cover question flow, brief structure, and the absence of the fake grill behaviour.
