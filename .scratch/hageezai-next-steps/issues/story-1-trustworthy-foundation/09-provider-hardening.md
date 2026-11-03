# 09 — Provider hardening

**What to build:** Cloud model calls have a bounded timeout, can be aborted, retry only transient failures, and fail with stable product errors instead of raw provider exceptions or leaked request data. Anthropic honours the configured temperature, and providers report token usage when available.

**Blocked by:** 02 — Secure config storage.

**Status:** resolved

**Covers:** NEXT_STEPS Step 7.

- [x] Cloud calls default to a 60-second timeout and accept a configured timeout; older configs fall back at call time.
- [x] Callers can pass an abort signal through every provider.
- [x] Rate limits, server errors, and connection timeouts retry at most three attempts with exponential backoff and jitter; authentication failures do not retry.
- [x] Provider failures map to `AUTH`, `RATE_LIMIT`, `TIMEOUT`, or `PROVIDER`; existing empty-response codes remain.
- [x] Anthropic receives the configured temperature, and reported token usage is returned.
- [x] Errors never contain API keys or request bodies, and tests use fake transports without network access.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
