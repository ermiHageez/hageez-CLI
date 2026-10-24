# 12 — Ollama connection and model kinds

**What to build:** A user can connect a local Ollama server, test it, list its live models, and run a Task through a local model with no API key. Chat and embedding models are distinguished, local calls can take longer than cloud calls, and an unreachable server or missing model produces an actionable error.

**Blocked by:** 11 — Cloud connections and model catalog.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 7a, Ollama.

- [ ] Adding a local Ollama connection works without a key and honours the configured base URL, then the environment host, then the default local address.
- [ ] Testing the connection lists live models, marking chat and embedding models from capabilities with a name-based fallback.
- [ ] A model call through the local connection returns text; embedding models are rejected for chat.
- [ ] Local calls default to a 300-second timeout while cloud calls stay at 60 seconds.
- [ ] A stopped server raises `PROVIDER_UNREACHABLE` with a `ollama serve` hint; a missing model raises `MODEL_NOT_FOUND` with a pull hint, never a stack trace.
- [ ] Each connection stores a concurrency limit defaulting to one for Ollama and three for cloud.
- [ ] Tests use a fake HTTP server and cover chat, model listing, classification, timeout, and both error paths.
