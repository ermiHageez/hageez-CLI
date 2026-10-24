# 11 — Cloud connections and model catalog

**What to build:** A user can add, list, test, and remove named cloud connections, including an OpenAI-compatible endpoint with a custom base URL, and choose which connection and model is the default. Model calls resolve through the connection registry, `models` lists available models, and doctor shows each connection's reachability and agent usage.

**Blocked by:** 10 — Connection schema expansion.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 7a, cloud connections.

- [ ] `connect add` supports the four cloud provider types plus a custom OpenAI-compatible base URL, with masked key input or an environment-variable name.
- [ ] `connect list`, `connect test`, and `connect remove` operate on named connections and never print keys.
- [ ] A default connection and model can be selected, and model calls use that connection.
- [ ] `models` lists the built-in cloud catalog for a connection and allows an override.
- [ ] Doctor shows every connection, whether it is reachable, and how many agents use it.
- [ ] Tests cover add/list/test/remove, custom base URL resolution, default resolution, and unreachable connections without network access.
