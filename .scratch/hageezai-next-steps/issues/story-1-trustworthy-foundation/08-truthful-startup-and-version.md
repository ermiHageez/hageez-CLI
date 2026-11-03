# 08 — Truthful startup and single version source

**What to build:** Startup and doctor show the real state of the project: whether config and a key exist, whether this is a Git repository, whether `ai-learning/` exists, whether the project scan succeeded, and that Memory and RAG are not implemented. The CLI reports one version everywhere, read from the package metadata, and no longer advertises a hardcoded context size.

**Blocked by:** 02 — Secure config storage.

**Status:** resolved

**Covers:** NEXT_STEPS Step 6, startup and version portion.

- [x] Each startup status is derived from a real check; no row is always shown as successful.
- [x] The config check performs no network call.
- [x] Memory and RAG say `off (not implemented)`.
- [x] The hardcoded `Context: 128k` claim is removed.
- [x] Startup, doctor, and `--version` all report the package version from one source.
- [x] Tests cover the status booleans and version source without requiring a network or a real key.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
