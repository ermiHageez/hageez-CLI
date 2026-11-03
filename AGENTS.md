# HageezAI — Agent Instructions

## What this repo is

`hageezai-cli` v1.0.0: the HageezAI command-line assistant, written in TypeScript and compiled to CommonJS.
Entry point is `src/index.ts` (commander); the interactive shell starts in `src/ui/repl.ts`.
The Build pipeline is `src/commands/build.ts`; it runs the graph in `src/pipeline/` through `src/orchestrator/`, composing `src/filesystem`, `src/planner`, `src/builder`, `src/commands/approval.ts`, and `src/reviewer`.
Vocabulary and canonical terms are in `CONTEXT.md`; architectural decisions are in `docs/adr/`.

## Commands

```bash
npm run lint                 # tsc --noEmit -p tsconfig.test.json
npm test                     # compile tests -> dist-test/ and run node:test
npm run build                # tsc -> dist/
node dist/index.js --version # run the local build
node dist/index.js doctor    # health check
npm link                     # expose this checkout as global `hageez`
npm install -g ./hageezai-cli-1.0.0.tgz  # install the packed release
```

`dist/` is stale after source edits until `npm run build`. The test build writes `dist-test/`.

## Layout

- `src/core/` — types, config, version, telemetry, provider clients (`callLLM`) and retry policy
- `src/commands/` — one module per CLI command; `build.ts` is the pipeline and `approval.ts` gates writes
- `test/` — `node:test` shards compiled to `dist-test/`
- `src/ui/` — REPL, startup, dashboard, theme, progress, streaming, file references
- `src/{agents,artifacts,orchestrator,pipeline,skills}/` — agent registry/runtime, run artifacts, graph scheduling, final pipeline, and skill loading
- `src/{filesystem,git,memory,planner,builder,reviewer,debugger,tools}/` — supporting modules
- `docs/adr/` — decisions; `AI_PLAN/WHATS_LEFT.md` — open backlog

## Conventions

- TypeScript strict mode; CommonJS modules; named exports.
- Failures surface as `HageezError` with a stable `code`.
- User-facing text goes through `src/ui/theme.ts` helpers.
- Never log API keys or file contents; keep new behavior consistent with `CONTEXT.md`.

## Verified pitfalls

- `chalk@5` and `inquirer@10` are ESM-only but loaded from CommonJS; `engines`, the lockfile, and `doctor` require Node >=22.12.0 (ADR-0001, ticket 14).
- Build has six steps; there is no committing/documenting step. `--tdd` and `--prd` are not build flags; `plan --prd` remains.
- `builder.generate` updates every `@file` reference, retries extraction once, and throws `NO_CODE_BLOCK` before any write. `applyBuilderResult` validates the whole batch first.
- `--via-opencode` runs `opencode run -- <task>` with argv arrays; a missing binary is `OPENCODE_NOT_FOUND`, a non-zero exit is `OPENCODE_FAILED`.
- There is no sandbox. Build previews diffs and requires per-file approval or `--yes`; backups go under `ai-learning/backups/`, but approved writes still go directly to disk (ADR-0003).
- Non-interactive Build without `--yes` or `--dry-run` refuses. `--dry-run` writes no target files, backups, `ai-learning/`, or Session Log, and cannot be combined with `--via-opencode`.
- `~/.hageezai/config.json` uses the version 2 named-connection shape and stores inline API keys in plaintext; the directory is `0700` and the file `0600`. `HAGEEZ_API_KEY`, `HAGEEZ_PROVIDER`, and `HAGEEZ_MODEL` override the default connection without being persisted; v1 configs migrate with a `config.v1.json` backup.
- Startup and doctor derive Git, `ai-learning/`, key/config, Memory Decision count, and project state from real checks; RAG remains `off (not implemented)`.
- Dead paths: `src/commands/slash.ts`, `printFullDashboard`, telemetry `track`, memory `recallDecision`, streaming and markdown helpers.
- The repository is a git repository; do not rewrite history or commit unless asked. The user normally handles Git.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
