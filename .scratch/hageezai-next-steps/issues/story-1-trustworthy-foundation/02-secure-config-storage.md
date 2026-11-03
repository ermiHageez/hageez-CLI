# 02 — Secure config storage

**What to build:** A user can store provider credentials in the global config or supply them through environment variables without the key being world-readable or printed. Existing loose config permissions are repaired on load, and permission failures stop the operation instead of continuing insecurely.

**Blocked by:** 01 — Test harness and CI.

**Status:** resolved

**Covers:** NEXT_STEPS Step 1.

- [x] A new config directory is created as `0700` and the config file as `0600`; an existing looser file is chmodded on load.
- [x] If chmod fails, loading fails with `CONFIG_PERMISSION_ERROR` and never continues with insecure permissions.
- [x] Read, parse, and write failures surface distinct stable errors.
- [x] Environment overrides for key, provider, and model win over the file, ignore empty values, reject an unsupported provider, and are never written back.
- [x] Interactive initialisation masks the key, and no command prints the key.
- [x] Tests use a temporary home directory and assert modes and overrides without exposing secrets.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
