# 16 — Agent model assignment

**What to build:** A user can assign a connection and model to each of the ten Agents, either individually or with local, cloud, or mixed presets, and every run resolves that assignment before starting. The CLI shows the agent-to-model table before a run, refuses embedding models, and warns about weak or unreachable assignments.

**Blocked by:** 15 — Agent runtime.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 10a.

- [ ] The registry contains exactly `analyst`, `product-brief`, `pm`, `ux-designer`, `architect`, `project-context`, `build`, `code-review`, `qa-tests`, and `retrospective`.
- [ ] Resolution uses a command-line override, then the agent assignment, then the default model.
- [ ] `assign` supports interactive assignment, one agent, all agents, the local/cloud/mixed presets, `show`, and `reset`.
- [ ] The mixed preset puts the four light agents on local and the six heavy agents on cloud, exactly as specified.
- [ ] Assigning an embedding model is refused; assigning a model of 3B parameters or fewer to architecture, Build, or review warns without blocking.
- [ ] Unreachable connections or empty key variables warn at assignment time and fail before any agent starts.
- [ ] Every run and every dry-run prints the agent-to-model table and the connections in use.
- [ ] Doctor lists agents whose assigned connection is unreachable, and tests cover resolution, presets, validation, and the pre-run table.
