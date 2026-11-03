# 12 — Ollama connection and model kinds

**What to build:** A user can connect a local Ollama server, test it, list its live models, and run a Task through a local model with no API key. Chat and embedding models are distinguished, local calls can take longer than cloud calls, and an unreachable server or missing model produces an actionable error.

**Blocked by:** 11 — Cloud connections and model catalog.

**Status:** resolved

**Covers:** NEXT_STEPS Step 7a, Ollama.

- [x] Adding a local Ollama connection works without a key and honours the configured base URL, then the environment host, then the default local address.
- [x] Testing the connection lists live models, marking chat and embedding models from capabilities with a name-based fallback.
- [x] A model call through the local connection returns text; embedding models are rejected for chat.
- [x] Local calls default to a 300-second timeout while cloud calls stay at 60 seconds.
- [x] A stopped server raises `PROVIDER_UNREACHABLE` with a `ollama serve` hint; a missing model raises `MODEL_NOT_FOUND` with a pull hint, never a stack trace.
- [x] Each connection stores a concurrency limit defaulting to one for Ollama and three for cloud.
- [x] Tests use a fake HTTP server and cover chat, model listing, classification, timeout, and both error paths.

## Comments

- 2026-10-25: Implemented Ollama chat, live model listing/classification, 300s local timeout, local concurrency default, actionable unreachable/model-missing errors, and fake-HTTP tests. `npm run lint`, `npm test` (70 tests), and `npm run build` pass.
