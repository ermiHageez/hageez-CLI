# HageezAI

**AI Software Engineering Platform that Understands, Builds and Improves with You.**

HageezAI is an AI software engineering assistant that runs as a command-line tool inside an existing project. It inspects the project, plans a task, generates or edits code, reviews the result, and records the run locally.

> **Status:** v1.0.0 is an early release under active hardening. Build writes directly to disk, some advertised flags are not wired yet, and the API key is stored in plaintext. Read [Project status](#project-status) before using it on important code.

## Features

- **Project-aware assistance** — scans the language, framework, database, build tool, files, and dependencies before planning.
- **Plan before building** — produces execution plans, PRDs, or ticket breakdowns without writing files.
- **Build pipeline** — plans a task, generates code, reviews the result, and records the attempt in `ai-learning/`.
- **Everyday engineering commands** — explain, review, debug, document, and commit from the same CLI.
- **Interactive shell** — run `hageez` for a REPL with Build and Plan modes.
- **Provider flexibility** — OpenAI, Anthropic, xAI (Grok), and Groq.
- **Project memory** — stores decisions and session records under the target project's `ai-learning/` directory.
- **IDE context** — `hageez init` can generate `AGENTS.md` and optional Cursor integration files.

## Requirements

- **Node.js 22.12 or newer** — the CLI loads ESM-only dependencies from CommonJS and needs stable `require(esm)` support. The `>=18` value currently in `package.json` is being corrected; see [ADR-0001](docs/adr/0001-commonjs-esm-runtime-floor.md).
- **npm**.
- **Git** for the review and commit commands. A clean Git baseline is strongly recommended before Build because the current release has no sandbox.

## Install

From a checkout:

```bash
git clone https://github.com/ermihageez/hageezai.git
cd hageezai
npm install
npm run build
npm link
```

Or install the packed release:

```bash
npm install -g ./hageezai-cli-1.0.0.tgz
```

Verify the install:

```bash
hageez --version
hageez doctor
```

## Quick start

Run `init` inside the project you want HageezAI to work on:

```bash
cd /path/to/your-project
hageez init
hageez doctor
hageez build "Add pagination to the users list"
```

Then start the interactive shell with:

```bash
hageez
```

`hageez init` stores provider settings in `~/.hageezai/config.json`, creates the project's `ai-learning/` directory, and writes `AGENTS.md`. Use `hageez init --cursor` to also generate Cursor commands and rules.

## Commands

| Command | Purpose |
|---|---|
| `hageez` | Start the interactive shell. |
| `hageez init` | Configure a provider and API key, then initialize the current project. |
| `hageez build [task]` | Run the Build pipeline for a task. |
| `hageez plan [task]` | Create an execution plan. Use `--prd` for a PRD or `--tickets` for a breakdown. |
| `hageez explain [target]` | Explain a file, function, or concept. |
| `hageez review` | Review code changes for quality, security, and best practices. Use `--staged` for staged Git changes only. |
| `hageez debug [error]` | Diagnose and fix an error. |
| `hageez commit` | Generate a conventional commit message from staged changes. Use `--push` to push afterward. |
| `hageez docs [target]` | Generate documentation for a file or the whole project. |
| `hageez chat` | Start an interactive chat that does not write files. |
| `hageez doctor` | Check config, Git, project analysis, and local memory state. |
| `hageez grill` | Legacy alias for `hageez plan --prd`; the Socratic product-brief agent is planned. |

## How it works

1. **Scan** — detect the project's language, framework, database, build tool, and file structure.
2. **Plan** — turn the task into a plan or PRD without touching project files.
3. **Build** — generate or edit code through the Build pipeline.
4. **Review** — inspect the result and record the outcome.
5. **Learn** — persist session records and decisions in `ai-learning/` for later runs.

The current release runs a single Build pipeline. The planned multi-agent graph — analyst, product brief, PM/UX/architect, project context, Build, review/QA, retrospective — is specified in [NEXT_STEPS.md](NEXT_STEPS.md).

## Configuration and security

Configuration lives at:

```text
~/.hageezai/config.json
```

It contains the selected provider, model, API key, token limit, temperature, and memory/RAG settings.

Until the config-hardening work lands:

- The API key is stored in **plaintext**. Treat the file as a secret and restrict access with `chmod 600 ~/.hageezai/config.json`.
- Project writes are **direct**; there is no sandbox or approval gate yet. Commit before running Build and inspect diffs afterward.
- When the target project has a `.gitignore`, `ai-learning/` is added to it automatically.

## Project structure

```text
src/
  core/        Config, types, telemetry, provider clients
  commands/    One module per CLI command; build.ts is the pipeline
  ui/          REPL, startup, dashboard, theme, progress, streaming
  filesystem/  Project scanning and file writes
  planner/     Plan, PRD, and ticket generation
  builder/     Code generation and Build edits
  reviewer/    Review and diff analysis
  debugger/    Error diagnosis
  git/         Git status, diffs, and commits
  memory/      Session logs and project memory
  tools/       Shared tool helpers
docs/
  adr/         Architecture decisions
```

## Development

```bash
npm install
npm run lint       # TypeScript typecheck
npm run build      # compile to dist/
node dist/index.js --version
node dist/index.js doctor
```

There is no test script yet. Ticket `01` introduces the test harness and CI; until it lands, `npm run lint` and `npm run build` are the available checks.

## Roadmap

The hardening and multi-agent work is divided into four stories. Tickets are local markdown under `.scratch/hageezai-next-steps/issues/`.

| Story | Scope | Tickets |
|---|---|---|
| [1 — Trustworthy foundation](.scratch/hageezai-next-steps/issues/story-1-trustworthy-foundation/) | Tests/CI, config security, contained writes, approval gate, truthful Build and startup | `01–09` |
| [2 — Durable connections and Phase 1 gate](.scratch/hageezai-next-steps/issues/story-2-durable-connections-and-phase-1-gate/) | Config v2 expand/contract, cloud and Ollama connections, docs and release gate | `10–14` |
| [3 — Agent runtime and learning](.scratch/hageezai-next-steps/issues/story-3-agent-runtime-and-learning/) | Agent runtime, model assignment, artifacts, orchestrator, memory, skills | `15–20` |
| [4 — Agent graph and end-to-end pipeline](.scratch/hageezai-next-steps/issues/story-4-agent-graph-and-end-to-end-pipeline/) | Analyst through retrospective, review, QA, and the final pipeline | `21–31` |

Start with ticket `01`; only start a ticket after its blockers are complete.

## Project status

Known limitations in v1.0.0:

- Build's final "Committing & documenting" step is a no-op.
- `build --tdd`, `build --prd`, and `build --via-opencode` are present but not reliable; use `hageez plan --prd` for a PRD.
- `@file` handling can modify only the first referenced file.
- The config file permissions and environment overrides are not hardened yet.
- The Node.js floor is being raised to 22.12+.
- There is no automated test suite yet.

See [NEXT_STEPS.md](NEXT_STEPS.md), [AUDIT_REPORT.md](AUDIT_REPORT.md), and [AI_PLAN/WHATS_LEFT.md](AI_PLAN/WHATS_LEFT.md) for the full plan and audit findings.

## Documentation

- [CONTEXT.md](CONTEXT.md) — product vocabulary and canonical terms.
- [NEXT_STEPS.md](NEXT_STEPS.md) — implementation plan and locked decisions.
- [AGENTS.md](AGENTS.md) — instructions for AI agents working in this repository.
- [docs/adr/](docs/adr/) — architecture decisions.
- [.scratch/hageezai-next-steps/spec.md](.scratch/hageezai-next-steps/spec.md) — feature spec and ticket index.

## License

MIT. See `package.json` for package metadata.
