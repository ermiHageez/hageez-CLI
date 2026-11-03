# 10 — Connection schema expansion

**What to build:** A user can keep using their existing single-provider setup while the global config grows a version 2 schema for named connections, a default model, and per-agent assignments. Loading an old config migrates it to the new shape without losing the key and leaves a protected backup.

**Blocked by:** 02 — Secure config storage; 09 — Provider hardening.

**Status:** resolved

**Covers:** NEXT_STEPS Step 7a, expand phase.

- [x] A version 1 config loads and migrates into named connections plus a default model, with a protected backup of the original.
- [x] The migration preserves the existing provider, model, and key, and all existing commands still work.
- [x] The schema accepts named connections for the agreed provider types, including an environment-variable key reference or an inline key under the existing permission rules.
- [x] Default-model and agent-assignment fields exist in the schema but do not change agent behaviour yet.
- [x] Legacy fields remain readable so this expansion can land green before callers migrate.
- [x] Tests cover migration, backup permissions, env-key references, and continued legacy access without printing secrets.

## Comments

- 2026-10-25: Implemented config v2 with named connections, defaultModel, agents, v1 migration, and a 0600 `config.v1.json` backup. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
