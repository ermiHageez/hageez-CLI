# 15 — Agent runtime

**What to build:** A user can run a named Agent with a Task through the normal model configuration, receiving a structured result with its status, output artifacts, token usage, and any error. The runtime uses the timeout and retry behaviour already established for providers and does not yet change the existing Build pipeline.

**Blocked by:** 14 — Docs, license, and Node floor.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 10.

- [ ] An Agent definition carries its name, role, system prompt, optional connection/model override, inputs, outputs, and allowed tools.
- [ ] `hageez agent run <name> "task"` returns a structured result containing the agent, status, artifacts, tokens, and optional error.
- [ ] Agent execution uses the default model, provider timeout, retry, and error mapping.
- [ ] A trivial agent run works end to end with the configured default model.
- [ ] The existing Build pipeline behaviour is unchanged.
- [ ] Tests cover successful and failing runs without a live provider.
