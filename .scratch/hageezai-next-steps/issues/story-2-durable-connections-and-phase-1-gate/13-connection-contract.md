# 13 — Connection contract

**What to build:** The legacy single-provider fields are removed once every caller uses named connections, leaving one configuration shape while old configs still migrate safely. Users see no change in their saved setup, and no runtime path reads the retired fields.

**Blocked by:** 11 — Cloud connections and model catalog; 12 — Ollama connection and model kinds.

**Status:** resolved

**Covers:** NEXT_STEPS Step 7a, contract phase.

- [x] Every runtime caller resolves models through the connection registry and default or assigned model.
- [x] The configuration is written only in the version 2 shape.
- [x] Version 1 migration still preserves the existing setup and key.
- [x] Initialisation, doctor, Build, and the model catalog no longer read or write retired fields.
- [x] Tests prove migration and normal loading after the legacy fields are gone, with no secret printing.

## Comments

- 2026-10-25: Removed the legacy single-provider config shape. `HageezConfig` is now the v2 named-connection config, all provider calls go through `resolveModelConfig`, and init/doctor/Build/catalog use connections. Migration remains backed up. `npm run lint`, `npm test` (70 tests), and `npm run build` pass.
