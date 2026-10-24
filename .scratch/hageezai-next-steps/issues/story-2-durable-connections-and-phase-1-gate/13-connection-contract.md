# 13 — Connection contract

**What to build:** The legacy single-provider fields are removed once every caller uses named connections, leaving one configuration shape while old configs still migrate safely. Users see no change in their saved setup, and no runtime path reads the retired fields.

**Blocked by:** 11 — Cloud connections and model catalog; 12 — Ollama connection and model kinds.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 7a, contract phase.

- [ ] Every runtime caller resolves models through the connection registry and default or assigned model.
- [ ] The configuration is written only in the version 2 shape.
- [ ] Version 1 migration still preserves the existing setup and key.
- [ ] Initialisation, doctor, Build, and the model catalog no longer read or write retired fields.
- [ ] Tests prove migration and normal loading after the legacy fields are gone, with no secret printing.
