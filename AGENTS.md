# HageezAI — Agent Instructions

## What this repo is

`hageezai-cli` v1.0.0: the HageezAI command-line assistant, written in TypeScript and compiled to CommonJS.
Entry point is `src/index.ts` (commander); the interactive shell starts in `src/ui/repl.ts`.
The Build pipeline is `src/commands/build.ts`, composed from `src/filesystem`, `src/planner`, `src/builder`, and `src/reviewer`.
Vocabulary and canonical terms are in `CONTEXT.md`; architectural decisions are in `docs/adr/`.

## Commands

```bash
npm run lint                 # tsc --noEmit
npm run build                # tsc -> dist/
node dist/index.js --version # run the local build
node dist/index.js doctor    # health check
npm link                     # expose this checkout as global `hageez`
npm install -g ./hageezai-cli-1.0.0.tgz  # install the packed release
```

There is no test script and no source runner installed. `dist/` is stale after source edits until `npm run build`.

## Layout

- `src/core/` — types, config, telemetry, provider clients (`callLLM`)
- `src/commands/` — one module per CLI command; `build.ts` is the pipeline
- `src/ui/` — REPL, startup, dashboard, theme, progress, streaming, file references
- `src/{filesystem,git,memory,planner,builder,reviewer,debugger,tools}/` — supporting modules
- `docs/adr/` — decisions; `AI_PLAN/WHATS_LEFT.md` — open backlog

## Conventions

- TypeScript strict mode; CommonJS modules; named exports.
- Failures surface as `HageezError` with a stable `code`.
- User-facing text goes through `src/ui/theme.ts` helpers.
- Never log API keys or file contents; keep new behavior consistent with `CONTEXT.md`.

## Verified pitfalls

- `chalk@5` and `inquirer@10` are ESM-only but loaded from CommonJS; `engines` says Node >=18 (see ADR-0001).
- `builder.generate` returns inside its `@file` loop, so only the first referenced file is modified.
- Build step 7 ("Committing & documenting") is a no-op; `--tdd` and `--prd` do not change behavior.
- `--via-opencode` calls `opencode assist`, which is not a valid opencode subcommand.
- There is no sandbox: `writeFiles` writes directly to disk (see ADR-0003).
- `~/.hageezai/config.json` stores the API key in plaintext; the file may be group/other-readable.
- Dead paths: `src/commands/slash.ts`, `printFullDashboard`, telemetry `track`, memory `rememberDecision`/`recallDecision`, streaming and markdown helpers.
- The repository is not a git repository; do not assume history.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
