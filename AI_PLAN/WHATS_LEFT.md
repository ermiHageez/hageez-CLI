> **Historical audit snapshot (2026-10-24).** It is superseded by `README.md` and `NEXT_STEPS.md`; tickets `01–31` are implemented.

# HageezAI — What Is Left

Status snapshot of the **as-built** `hageezai-cli` v1.0.0 (TypeScript/CommonJS, Node >=18 declared).
Compiled from all 30 source files on 2026-10-24. Every claim cites `file:line`.

**Bottom line:** the CLI runs end-to-end for the core loop (scan → intent → plan → generate → write → review), but the product advertises several things it does not do (RAG, skills, sandbox, streaming, memory recall, telemetry, commit/document step), and there are five correctness/safety defects worth fixing before any new feature work.

---

## 1. Works today

| Capability | Evidence |
|---|---|
| CLI with 10 commands + interactive REPL | `src/index.ts:18-131`, `src/ui/repl.ts:303-459` |
| Config load/save at `~/.hageezai/config.json` | `src/core/config.ts:6-68` |
| Four providers behind one `callLLM` | `src/core/llm/client.ts:7-26` |
| Project scanning (language, framework, DB, build tool, LOC, branch) | `src/filesystem/index.ts:59-142` |
| Build pipeline steps 1–6 (intent, plan, generate, write, review) | `src/commands/build.ts:149-210` |
| File writing and deletion | `src/builder/index.ts:45-73` |
| Session logging to `ai-learning/session_logs/` | `src/commands/build.ts:220-228`, `src/memory/index.ts:16-35` |
| `@file` reference parsing (3 patterns) | `src/ui/filerefs.ts:33-93` |
| Git diff/review/commit helpers | `src/git/index.ts:7-36` |
| Doctor health check + project analysis | `src/commands/doctor.ts:9-104` |
| Local-run pack/global-link workflow | `package.json:6-12`, global install at `/usr/lib/node_modules/hageezai-cli` |

---

## 2. Priority backlog

Legend: **P0** = correctness, safety, or broken promise; **P1** = product gap; **P2** = polish/debt.

### P0 — fix before adding features

| ID | Item | Evidence | Acceptance |
|---|---|---|---|
| P0-1 | **No sandbox, but UI claims "Sandbox: Enabled"** — builder writes files immediately with no diff or confirmation. Either implement dry-run/diff approval or remove the claim. | `src/builder/index.ts:45-73`; `src/ui/startup.ts:94`; `src/ui/dashboard.ts:70` | No UI text claims isolation; write path either confirms per file or is documented as direct-write |
| P0-2 | **`--via-opencode` runs an invalid subcommand** `opencode assist`; real command is `opencode run`. | `src/tools/index.ts:30` | `hageez build --via-opencode "task"` launches `opencode run "task"` |
| P0-3 | **Only the first `@file` is ever modified** — `return` inside the `for` loop. | `src/builder/index.ts:89-119` (return at 117) | All referenced files are updated in one build |
| P0-4 | **Node floor mismatch** — CJS output requires ESM-only `chalk@5`/`inquirer@10`; `require(ESM)` needs newer Node than the declared `>=18`. | `package.json:34-36`; `tsconfig.json:4`; deps `chalk ^5.3.0`, `inquirer ^10.1.8` | Engines raised (20.19+/22.12+) or deps pinned/ESM migration planned |
| P0-5 | **API key stored plaintext at mode `0664`** (group/other readable) with no permission hardening. | `src/core/config.ts:41-44`; verified `664 /home/ermiyas/.hageezai/config.json` | Config written `0600`; migration/chmod on load; SECURITY.md documents it |
| P0-6 | **Startup status is fake** — "Connected / Memory / RAG / Git / Project Loaded" are hardcoded ✔; `runStartup` never receives project data. | `src/ui/startup.ts:13-19`, `src/index.ts:126-127` | Status values computed from config, git, scan, and RAG availability |

### P1 — complete or remove advertised features

| ID | Item | Evidence | Acceptance |
|---|---|---|---|
| P1-1 | **RAG is not implemented** — only a config flag, badge, placeholder command, and empty `ai-learning/embeddings/` dirs. Decision: *Planned*. | `src/core/types.ts:10`; `src/commands/init.ts:53-56`; `src/commands/slash.ts:202-211`; `src/commands/build.ts:25-34` | Index/retrieve pipeline, or flag removed from init/config/UI until real |
| P1-2 | **Skills never load** — `buildSystemPrompt(projectContext, skills)` always gets `''`; `Skill`/`SkillRegistry` types unused; init only prints `npx skills` commands. Decision: *Planned*. | `src/core/llm/client.ts:28-49`; calls at `src/planner/index.ts:15-18`, `src/commands/chat.ts:17-20`; `src/core/types.ts:77-88`; `src/commands/init.ts:83-92` | Registered skills are read and injected into system prompts |
| P1-3 | **Memory recall is unwired** — `rememberDecision`/`recallDecision` have zero callers; only session logging runs. Decision: *Partial*. | `src/memory/index.ts:78-111`; only `logSession` used (`src/commands/build.ts:13,220`) | Decisions are written during build and recalled into context |
| P1-4 | **Telemetry is unwired** — `track()` has zero call sites and ignores `telemetryEnabled`; file writes to `~/.hageezai/telemetry.jsonl` unconditionally. Decision: *Partial*. | `src/core/telemetry.ts:16-30`; flag at `src/core/config.ts:66` | Events emitted when enabled; no writes when disabled |
| P1-5 | **Pipeline step 7 "Committing & documenting" is a no-op** — marked done after 300 ms. | `src/commands/build.ts:64`, `212-214` | Step performs commit/docs or is renumbered/removed |
| P1-6 | **`--tdd` and `--prd` are accepted but do nothing** — TDD only prints a label; PRD option is never read. | `src/commands/build.ts:17-21`, `107`; `src/index.ts:38-42` | Flags change pipeline behavior or are removed |
| P1-7 | **`hageez grill` is a misleading alias** for `plan --prd`, not the advertised Socratic skill. | `src/index.ts:104-110`; advertised `src/commands/slash.ts:155-158` | Command invokes intended flow or is renamed/documented as alias |
| P1-8 | **Chat is not streaming** — `streamLLMResponse` imported, never used; response printed after the full call. | `src/commands/chat.ts:6`, `51-57`; `src/ui/streaming.ts:24-48` | Tokens stream as they arrive, or dead import removed |
| P1-9 | **No tests and no test script** — `npm test` undefined; zero test files. | `package.json:9-13` | Minimal unit tests (providers mocked, scanner, filerefs, builder extraction) |
| P1-10 | **Two command systems, one dead** — `slash.ts` registry never registered; REPL duplicates its own list. | `src/commands/slash.ts:10-234`; no `registerBuiltinCommands` callers; `src/ui/repl.ts:18-36` | One registry used by REPL and help |
| P1-11 | **Dashboard entry point is dead** — `printFullDashboard` imported but never called; startup is used instead. | `src/index.ts:5`; `src/ui/dashboard.ts:74-125` | Delete or wire it (consolidate with startup) |
| P1-12 | **`getRecentSessions` never used** — dashboard supports recent sessions that never render. | `src/memory/index.ts:37-67`; `src/ui/dashboard.ts:113-120` | Startup shows recent sessions or code removed |

### P2 — polish, consistency, cleanup

| ID | Item | Evidence |
|---|---|---|
| P2-1 | Version duplicated: `package.json:3` vs `src/ui/theme.ts:39` (`VERSION = '1.0.0'`) — drift risk | `src/ui/theme.ts:39` |
| P2-2 | Anthropic provider ignores `temperature` | `src/core/llm/anthropic.ts:13-21` |
| P2-3 | Hardcoded "Context: 128k" in startup and dashboard | `src/ui/startup.ts:93`; `src/ui/dashboard.ts:69` |
| P2-4 | REPL line editor is fragile: raw-mode arrow/history handling is incomplete, Tab is repurposed for mode switch | `src/ui/repl.ts:119-210`, `313-350` |
| P2-5 | Unused modules: markdown renderer, status bar, `streamText`, most git helpers, `validateProject`/`runCommand`, execution-plan types | `src/ui/markdown.ts`; `src/ui/statusbar.ts`; `src/ui/streaming.ts:3-22`; `src/git/index.ts:28-55`; `src/tools/index.ts:14-53`; `src/core/types.ts:28-40` |
| P2-6 | Architecture inference is only a file-count heuristic (`>200` monorepo, `>50` monolith) | `src/filesystem/index.ts:125-127` |
| P2-7 | Generated filename is a task slug with `.ts` always appended; no language/extension inference | `src/builder/index.ts:140` |
| P2-8 | `dist/` and `hageezai-cli-1.0.0.tgz` are stale relative to `src/`; global `hageez` is a separate copy | `dist/` timestamps; `/usr/bin/hageez` → `/usr/lib/node_modules/hageezai-cli/dist/index.js` |
| P2-9 | No `LICENSE` file although package declares MIT | `package.json:29` |
| P2-10 | Not a git repository (`git status` fails); no history to reconstruct a changelog | root |

---

## 3. Feature status matrix

Legend: **Implemented** | **Partial** | **Dead code** | **Planned** | **Not planned**

| Feature | Status | Evidence |
|---|---|---|
| init / doctor / explain / review / debug / docs / plan / chat / commit | Implemented (with caveats below) | `src/commands/*.ts` |
| build pipeline | Partial — step 7 no-op, artificial delays, flags ignored | `src/commands/build.ts:57-65`, `212-214` |
| `--via-opencode` | Partial — broken command name | `src/tools/index.ts:30` |
| `grill` command | Partial — alias only | `src/index.ts:104-110` |
| Providers (OpenAI, Anthropic, Grok, Groq) | Implemented — Anthropic drops temperature | `src/core/llm/*.ts` |
| Project scanner | Implemented — heuristic architecture | `src/filesystem/index.ts` |
| `@file` references | Partial — only first file modified | `src/builder/index.ts:89-119` |
| Session logging | Implemented | `src/memory/index.ts:16-35` |
| Memory (decisions) | Partial — read/write helpers unwired | `src/memory/index.ts:78-111` |
| RAG | Planned | flag/UI only; no retrieval code |
| Skills | Planned | types + install instructions only |
| Sandbox | Not planned | no code; UI claim only |
| Telemetry | Partial | writer exists, zero call sites |
| Streaming | Dead code | `src/ui/streaming.ts:24-48` |
| Dashboard | Dead code | `src/index.ts:5` |
| Slash-command registry | Dead code | `src/commands/slash.ts` |
| Markdown renderer / status bar | Dead code | `src/ui/markdown.ts`, `src/ui/statusbar.ts` |
| Tests | Absent | no test script, no files |
| Git extras (branch/status) | Dead code | `src/git/index.ts:28-55` |

---

## 4. Documentation still to create

Location: repo root and `docs/` (not `AI_PLAN/`). Nothing is started yet.

| Batch | File | Purpose | Cap |
|---|---|---|---|
| 1 | `CONTEXT.md` | Glossary: HageezAI, hageez, Task, Build, Plan, Provider, Model, Project Context, File Reference, Session Log, Chat History, REPL History, Memory, ai-learning | 120 |
| 1 | `docs/adr/0001-commonjs-esm-runtime-floor.md` | CJS + ESM-only deps vs Node >=18 | 40 |
| 1 | `docs/adr/0002-config-and-artifact-layout.md` | Global config vs project-local `ai-learning/` | 40 |
| 1 | `docs/adr/0003-direct-write-trust-model.md` | Direct writes, no sandbox | 40 |
| 1 | `AGENTS.md` | Agent instructions, repo map, pitfalls | 80 |
| 2 | `README.md` | Install, quickstart, commands, limitations | 150 |
| 2 | `docs/COMMANDS.md` | Every command/flag and its real behavior | 300 |
| 2 | `docs/CONFIGURATION.md` | Config schema, provider defaults, security note | 200 |
| 3 | `docs/ARCHITECTURE.md` | Mermaid flow, module map, dead code, known bugs | 450 |
| 3 | `docs/DATA-FORMATS.md` | Config, telemetry, session, memory, ai-learning schemas | 200 |
| 3 | `docs/SECURITY.md` | Key storage, data egress, prompt injection, command exec | 150 |
| 4 | `docs/FEATURES.md` | Status matrix + roadmap (this document, formalized) | 250 |
| 4 | `docs/DEVELOPMENT.md` | Build, lint, local run, link/publish, release checklist | 200 |

---

## 5. Suggested execution order

1. **Sprint A (safety):** P0-1, P0-2, P0-3, P0-5, P0-6.
2. **Sprint B (runtime truth):** P0-4, P1-5, P1-6, P1-7, P1-8.
3. **Sprint C (wire or remove):** P1-3, P1-4, P1-10, P1-11, P1-12.
4. **Sprint D (features):** P1-1 (RAG), P1-2 (skills) — only after A–C.
5. **Sprint E (quality):** P1-9 tests, P2 cleanup, LICENSE, version single-sourcing.
6. **Sprint F (docs):** the 13 files above, in four batches, ending with a citation/link verification pass.

---

## 6. Verification commands

```bash
npm run lint                          # tsc --noEmit, currently clean
npm run build                         # tsc -> dist
node dist/index.js --version          # HageezAI v1.0.0
node dist/index.js doctor             # config, git, ai-learning, project scan
grep -rn "registerBuiltinCommands" src --include="*.ts"   # 0 callers
grep -rn "track(" src --include="*.ts"                    # 0 call sites
grep -rn "rememberDecision\|recallDecision" src --include="*.ts" | grep -v "export "  # 0 callers
stat -c '%a' ~/.hageezai/config.json  # currently 664
git status                            # fatal: not a git repository
```

---

## 7. Decisions already made

- Docs describe **as-built** behavior with a features status matrix, not aspirational claims.
- RAG and Skills are **Planned**; Sandbox is **Not planned** (remove the claim); Telemetry and Memory are **Partial**.
- One root `CONTEXT.md`; three ADRs; engineering-grade evidence; four doc batches.
- Local dev currently means `npm run build && node dist/index.js` or `npm link`; no source runner is installed.
- Out of scope for now: LICENSE creation, `tsx` dev runner, git initialization.
