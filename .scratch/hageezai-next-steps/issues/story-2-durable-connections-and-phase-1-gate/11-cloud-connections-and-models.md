# 11 — Cloud connections and model catalog

**What to build:** A user can add, list, test, and remove named cloud connections, including an OpenAI-compatible endpoint with a custom base URL, and choose which connection and model is the default. Model calls resolve through the connection registry, `models` lists available models, and doctor shows each connection's reachability and agent usage.

**Blocked by:** 10 — Connection schema expansion.

**Status:** resolved

**Covers:** NEXT_STEPS Step 7a, cloud connections.

- [x] `connect add` supports the four cloud provider types plus a custom OpenAI-compatible base URL, with masked key input or an environment-variable name.
- [x] `connect list`, `connect test`, and `connect remove` operate on named connections and never print keys.
- [x] A default connection and model can be selected, and model calls use that connection.
- [x] `models` lists the built-in cloud catalog for a connection and allows an override.
- [x] Doctor shows every connection, whether it is reachable, and how many agents use it.
- [x] Tests cover add/list/test/remove, custom base URL resolution, default resolution, and unreachable connections without network access.

## Comments

- 2026-10-25: Implemented named cloud/openai-compatible connections, registry-based default and agent resolution, connect add/list/show/test/use/remove, model catalogs, doctor reachability/agent usage, and tests. `npm run lint`, `npm test` (70 tests), and `npm run build` pass.
