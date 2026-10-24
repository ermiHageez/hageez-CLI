# 10 — Connection schema expansion

**What to build:** A user can keep using their existing single-provider setup while the global config grows a version 2 schema for named connections, a default model, and per-agent assignments. Loading an old config migrates it to the new shape without losing the key and leaves a protected backup.

**Blocked by:** 02 — Secure config storage; 09 — Provider hardening.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 7a, expand phase.

- [ ] A version 1 config loads and migrates into named connections plus a default model, with a protected backup of the original.
- [ ] The migration preserves the existing provider, model, and key, and all existing commands still work.
- [ ] The schema accepts named connections for the agreed provider types, including an environment-variable key reference or an inline key under the existing permission rules.
- [ ] Default-model and agent-assignment fields exist in the schema but do not change agent behaviour yet.
- [ ] Legacy fields remain readable so this expansion can land green before callers migrate.
- [ ] Tests cover migration, backup permissions, env-key references, and continued legacy access without printing secrets.
