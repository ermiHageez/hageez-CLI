# 18 — Orchestrator

**What to build:** A pipeline is a dependency graph that runs independent Agents in parallel, respects per-connection concurrency, skips only the dependents of a failed Agent, and keeps the single-writer rule. The user sees live progress as Agents start, finish, skip, or fail.

**Blocked by:** 16 — Agent model assignment; 17 — Artifact store.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 12.

- [ ] Pipeline definitions are dependency graphs and cycles are rejected before execution.
- [ ] Independent nodes run in parallel, while a node waits for all of its dependencies.
- [ ] A test graph `A -> (B, C parallel) -> D` runs B and C concurrently and D afterward.
- [ ] Global concurrency defaults to three, and each connection's concurrency limit is respected; Agents sharing a single-slot Ollama connection queue.
- [ ] A failed node marks its dependents skipped while independent branches continue.
- [ ] Only the `build` Agent may write project files; every other Agent writes artifacts only.
- [ ] Progress is printed per Agent, and tests cover ordering, parallelism, connection limits, failure propagation, and the single-writer rule.
