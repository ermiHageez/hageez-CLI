# HageezAI

**AI Software Engineering Platform that Understands, Builds and Improves with You.**

HageezAI is an AI software engineering assistant that runs as a command-line tool inside an existing project. It inspects the project, plans a task, generates or edits code, reviews the result, and records the run locally.

> **Status:** v1.0.0 is an early release under active hardening. Build previews diffs and asks before writing, but there is still no sandbox; RAG is not implemented yet. Read [Project status](#project-status) before using it on important code.

## Features

- **Project-aware assistance** — scans the language, framework, database, build tool, files, and dependencies before planning.
- **Plan before building** — produces execution plans, PRDs, or ticket breakdowns without writing files.
- **Build pipeline** — plans a task, generates code, previews a diff, asks for approval, applies changes, and reviews the result.
- **Everyday engineering commands** — explain, review, debug, document, and commit from the same CLI.
- **Interactive full-screen TUI** — run `hageez` for a full-screen terminal interface with a 40-column agent sidebar, animated robot sprites, live scrolling feed, floating slash menu, and in-TUI diff approval modal. See [docs/UI.md](docs/UI.md). Pass `--no-tui` for the classic line-based REPL.
- **Named connections** — OpenAI, Anthropic, xAI (Grok), Groq, OpenAI-compatible endpoints, and local Ollama servers. Assign a default model or per-agent models.
- **Project memory** — stores Decisions, Build Session Logs, candidate skills, and backups under the target project's `ai-learning/` directory.
- **IDE context** — `hageez init` can generate `AGENTS.md` and optional Cursor integration files.

## Requirements

- **Node.js 22.12 or newer** — the CLI loads ESM-only dependencies from CommonJS and needs stable `require(esm)` support. `package.json`, the lockfile, and `doctor` enforce this floor; see [ADR-0001](docs/adr/0001-commonjs-esm-runtime-floor.md).
- **npm**.
- **Git** for the review and commit commands. A clean Git baseline is strongly recommended before Build because the current release has no sandbox, even though writes are gated and backed up.

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
| `hageez connect add/list/show/test/use/remove` | Manage named cloud or Ollama connections and choose the default model. |
| `hageez models [connection]` | List a connection catalog. Use `--add <model>` or `--reset`. |
| `hageez build [task]` | Run the Build pipeline. Use `--dry-run` to preview, `--yes` to approve all changes, or `--via-opencode` to delegate. |
| `hageez plan [task]` | Create an execution plan. Use `--prd` for a PRD or `--tickets` for a breakdown. |
| `hageez explain [target]` | Explain a file, function, or concept. |
| `hageez review` | Review code changes for quality, security, and best practices. Use `--staged` for staged Git changes only. |
| `hageez debug [error]` | Diagnose and fix an error. |
| `hageez commit` | Generate a conventional commit message from staged changes. Use `--push` to push afterward. |
| `hageez docs [target]` | Generate documentation for a file or the whole project. |
| `hageez chat` | Start an interactive chat that does not write files. |
| `hageez doctor` | Check config, Git, project analysis, and local memory state. |
| `hageez grill [task]` | Ask Socratic requirement questions through the product-brief agent. |
| `hageez agent list` / `hageez agent run <name> "task"` | List the ten agents or run one directly. |
| `hageez assign [agent] [connection:model]` | Show or change agent-to-model assignments. Use `--preset local|cloud|mixed`, `--all`, `show`, or `reset`. |
| `hageez memory list/add/remove/debug` | Manage project Decisions. |
| `hageez skills list/add/enable/disable` | Manage project and global skills. |

## How it works

1. **Analyze** — scan the project and turn the task into requirements and MVP scope.
2. **Plan** — the product-brief, PM, UX, and architect agents produce briefs, plans, designs, and draft ADRs.
3. **Build** — project context is merged, then the Build agent generates code and previews the diff for per-file approval.
4. **Verify** — code review and QA run in parallel; high-severity review issues trigger at most two extra Build passes.
5. **Learn** — artifacts, session records, Decisions, and candidate skills are stored under `ai-learning/`.

`hageez build "task"` runs the full multi-agent graph. `--dry-run` previews without writing, and non-interactive runs require `--yes`.

## Configuration and security

Configuration lives at:

```text
~/.hageezai/config.json
```

It uses the version 2 shape: named `connections`, a `defaultModel`, optional per-agent assignments, and shared token/temperature/memory settings. API keys may be inline or referenced through an environment variable. Version 1 configs migrate automatically, with a protected `config.v1.json` backup.

- The API key is stored in **plaintext**, but `~/.hageezai` is forced to `0700` and the config file to `0600` whenever it is read or written.
- `HAGEEZ_API_KEY`, `HAGEEZ_PROVIDER`, and `HAGEEZ_MODEL` override the default connection at load time and are never written back. `OLLAMA_HOST` supplies the local Ollama base URL when one is not configured.
- Build previews every affected file, asks `y`/`n`/`a` per file, and backs up existing update/delete targets under `ai-learning/backups/`.
- `--dry-run` writes nothing and does not create `ai-learning/` or a Session Log. Non-interactive runs require `--yes`.
- There is still **no sandbox** around approved writes. Commit before running Build and inspect diffs afterward.
- When the target project has a `.gitignore`, `ai-learning/` is added to it automatically.

## Project structure

```text
src/
  core/        Config, types, version, telemetry, provider clients and retry policy
  commands/    One module per CLI command; build.ts runs the pipeline; approval.ts gates writes
  agents/      Ten agent definitions, model assignment, and the agent runtime
  artifacts/   Run manifests and atomic artifacts under ai-learning/runs/
  orchestrator/ Graph validation, scheduling, concurrency, and single-writer control
  pipeline/    Agent implementations and the final end-to-end graph
  skills/      Project and global skill loading
  ui/          REPL, startup, dashboard, theme, progress, diffs, streaming
  filesystem/  Project scanning and file writes
  planner/     Plan, PRD, and ticket generation
  builder/     Code generation, multi-file edits, and path-safe writes
  reviewer/    Review and diff analysis
  debugger/    Error diagnosis
  git/         Git status, diffs, and commits
  memory/      Session logs, project Decisions, and recall
  tools/       Shared tool helpers
docs/
  adr/         Architecture decisions
```

## Development

```bash
npm install
npm run lint       # TypeScript typecheck (src + tests)
npm test           # compile tests to dist-test/ and run node:test
npm run build      # compile src/ to dist/
node dist/index.js --version
node dist/index.js doctor
```

The test shards live in `test/` and run with Node's built-in test runner. CI runs lint, build, and test on Node 22.12.

## Roadmap

The hardening and multi-agent work is divided into four stories. Tickets are local markdown under `.scratch/hageezai-next-steps/issues/`.

| Story | Scope | Tickets |
|---|---|---|
| [1 — Trustworthy foundation](.scratch/hageezai-next-steps/issues/story-1-trustworthy-foundation/) | Tests/CI, config security, contained writes, approval gate, truthful Build and startup | `01–09` |
| [2 — Durable connections and Phase 1 gate](.scratch/hageezai-next-steps/issues/story-2-durable-connections-and-phase-1-gate/) | Config v2 expand/contract, cloud and Ollama connections, docs and release gate | `10–14` |
| [3 — Agent runtime and learning](.scratch/hageezai-next-steps/issues/story-3-agent-runtime-and-learning/) | Agent runtime, model assignment, artifacts, orchestrator, memory, skills | `15–20` |
| [4 — Agent graph and end-to-end pipeline](.scratch/hageezai-next-steps/issues/story-4-agent-graph-and-end-to-end-pipeline/) | Analyst through retrospective, review, QA, and the final pipeline | `21–31` |

All four stories (`01–31`) are implemented: the trust foundation, named cloud/Ollama connections, the ten-agent runtime, artifacts, orchestration, memory, skills, and the final build pipeline.

## Project status

Known limitations in v1.0.0:

- There is no sandbox: approved Build writes still go directly to disk.
- Project Memory stores Decisions and candidate skills under `ai-learning/`; RAG remains `off (not implemented)`.
- The multi-agent graph runs through `hageez build`; artifacts and the run manifest live under `ai-learning/runs/`.

See [NEXT_STEPS.md](NEXT_STEPS.md), [AUDIT_REPORT.md](AUDIT_REPORT.md), and [AI_PLAN/WHATS_LEFT.md](AI_PLAN/WHATS_LEFT.md) for the full plan and audit findings.

## Documentation

- [CONTEXT.md](CONTEXT.md) — product vocabulary and canonical terms.
- [NEXT_STEPS.md](NEXT_STEPS.md) — implementation plan and locked decisions.
- [AGENTS.md](AGENTS.md) — instructions for AI agents working in this repository.
- [docs/adr/](docs/adr/) — architecture decisions.
- [.scratch/hageezai-next-steps/spec.md](.scratch/hageezai-next-steps/spec.md) — feature spec and ticket index.

## License

MIT. See [LICENSE](LICENSE) for the full text.
