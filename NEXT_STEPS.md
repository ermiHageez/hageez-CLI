# HageezAI — Next Steps

Execution plan based on `AUDIT_REPORT.md`, with the new **Step 7a** (local Ollama and named connections) and **Step 10a** (agent-to-model assignment) inserted after Steps 7 and 10. Step numbers are unchanged.

**Status:** All four stories complete (tickets 01–31); the multi-agent pipeline is implemented and tested.

## Rules for opencode

Paste these at the start of every session.

1. Do only the step you are given. Do not touch unrelated files.
2. After changes run `npm run lint` and `npm run build`. Both must exit 0.
3. Cite `file:line` for every change in your summary.
4. If something in the step is ambiguous or the code differs from the description, stop and report instead of guessing.
5. Never log or print API keys or file contents. A diff approval prompt may display changed lines to the user only; never persist them or send them to telemetry.
6. When finished, list: files changed, commands run with output, anything left undone.
7. Commit only the files for that step. Do not use blind `git add -A` after the baseline.

## Locked decisions

| Topic | Decision |
|---|---|
| Node floor | Raise to `>=22.12.0`; update `doctor`, ADR-0001, lockfile, and CI. |
| Test runner | `node:test` with tests compiled by `tsc` into `dist-test/`; no new runtime dependency. |
| Build step 7 / fake flags | Remove "Committing & documenting", `--tdd`, and `--prd` from `build`; keep `plan --prd`. |
| Non-TTY writes | Refuse unless `--yes`; `--dry-run` is allowed and writes nothing. |
| Path escape | Fail closed: validate the whole batch before any mutation; no partial writes. |
| Failed sessions | Write `outcome: 'failed'` plus optional `error`; retain `'error'` for old logs. |
| Config env overrides | A config file is still required. Env values override at load time but are never persisted. |
| Permission failure | If `chmod 0600` fails, fail with `CONFIG_PERMISSION_ERROR`; do not continue insecurely. |
| Baseline `.gitignore` | Preserve the existing file. Do not overwrite `.hageezai/` or other existing entries. |

---

## Phase 0: Safety and truth

### Step 0. Make changes reversible

**Why:** The repo is not a git repository, so a bad agent edit cannot be undone.

**Do this before any code step (human-run prerequisite):**

```bash
cd "/home/ermiyas/Desktop/New Folder/hageezAI"

# The existing .gitignore already contains these entries plus .hageezai/.
# Append only missing entries; never replace the file.
touch .gitignore
for entry in node_modules/ dist/ '*.tgz' ai-learning/; do
  grep -qxF "$entry" .gitignore || printf '%s\n' "$entry" >> .gitignore
done

git init
git status --short
git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "chore: baseline before audit fixes"
git log --oneline -1
```

Before committing, confirm `~/.hageezai/config.json` and any key material are not staged.

**Done when:** `git log` shows the baseline commit and `git status` is clean.

---

### Step 1. Protect the API key (E1, A19)

**Files:** `src/core/config.ts`, `src/commands/init.ts`

**Tasks:**

- Create `~/.hageezai` with mode `0700`; chmod an existing directory to `0700`.
- Write `~/.hageezai/config.json` with mode `0600`; call `chmodSync` after writing because `mode` is ignored for existing files.
- On every `loadConfig`, if the file mode is looser than `0600`, chmod it to `0600`. If chmod fails, throw `CONFIG_PERMISSION_ERROR`.
- Distinguish read errors (`CONFIG_READ_ERROR`) from JSON errors (`CONFIG_PARSE_ERROR`).
- Wrap write errors in `HageezError('CONFIG_WRITE_ERROR')`.
- Support env overrides: `HAGEEZ_API_KEY`, `HAGEEZ_PROVIDER`, `HAGEEZ_MODEL`. Env wins over file. Trim empty values and ignore them. Validate the provider against `openai|anthropic|grok|groq`; invalid values throw `CONFIG_INVALID_PROVIDER`.
- Env values are returned but never written back by `loadConfig`.
- In `init`, use `type: 'password'` with `mask: '*'` for the API key.

**Done when:**

```bash
npm run lint && npm run build
node dist/index.js doctor >/dev/null
stat -c '%a' ~/.hageezai/config.json   # 600
stat -c '%a' ~/.hageezai              # 700
node -e "const c=require('./dist/core').loadConfig(); console.log(c.provider, !!c.apiKey)"
HAGEEZ_PROVIDER=groq HAGEEZ_MODEL=test-model node -e "const c=require('./dist/core').loadConfig(); console.log(c.provider, c.model)"
```

Do not print the key itself.

**Prompt for opencode:**
> Do Step 1 of NEXT_STEPS.md. Harden config storage in `src/core/config.ts` and `src/commands/init.ts` exactly as listed. Do not change any other behavior.

**Commit:** `fix(config): enforce 0600 config and env overrides`

---

### Step 2. Contain the write path and remove the fake sandbox claim (E2, A1)

**Files:** `src/builder/index.ts`, `src/ui/startup.ts`, `src/ui/dashboard.ts`

**Tasks:**

- Add `resolveSafeProjectPath(projectRoot, requestedPath)`:
  - Resolve the project root and target.
  - Reject when `path.relative(root, target)` is empty, `..`, starts with `..` plus a separator, or is absolute.
  - Reject any path segment `.git` or `node_modules`.
  - Resolve the nearest existing ancestor with `fs.realpathSync` and verify it stays inside the real root, blocking symlink escapes.
  - Throw `HageezError('PATH_ESCAPE')` or `HageezError('PATH_FORBIDDEN')`.
- Absolute `@file` paths are allowed **only** when they resolve inside `projectRoot`.
- Pre-validate every file in the batch before writing or deleting. If any path is invalid, write nothing and return the error. Do not partially apply.
- Use relative paths in messages and backups; never print file contents.
- Remove "Sandbox: Enabled" from startup and dashboard. Replace with exactly: `Writes: direct (review changes with git)`.

**Done when:**

```bash
grep -rn "Sandbox" src          # no output
npm run lint && npm run build
node -e "const {applyBuilderResult}=require('./dist/builder');
const r=applyBuilderResult({content:'',tokensUsed:0,files:[{path:'../../x',action:'create',content:'x'}]}, process.cwd());
console.log(r);"                 # errors include PATH_ESCAPE; ../../x not created
```

Also verify a valid `src/...` path and an absolute path inside the project.

**Prompt:**
> Do Step 2 of NEXT_STEPS.md. Add path containment to the builder write and delete paths and remove the Sandbox claim from the UI.

**Commit:** `fix(builder): contain write paths and remove sandbox claim`

---

### Step 3. Fix `--via-opencode` (A2, E3)

**Files:** `src/tools/index.ts`, `src/commands/build.ts`

**Tasks:**

- Add a pure `buildOpencodeArgs(task)` returning `['run', '--', task]`.
- Replace `execSync` string interpolation with `execFile`/`spawn` and an argument array.
- Check `opencode` is installed with `execFileSync('opencode', ['--version'])`; do not use a shell `which`.
- Missing binary: `HageezError('OPENCODE_NOT_FOUND')`. Non-zero exit: `HageezError('OPENCODE_FAILED')`.
- In `build.ts`, wrap the call so the error prints cleanly, sets `process.exitCode = 1`, and never emits a stack trace.
- Refactor `runCommand` to `runCommand(file: string, args: string[] = [], cwd?: string)` using `execFile`; update `validateProject`.
- A task containing `; echo hacked` must remain one argv element.

**Done when:**

```bash
npm run lint && npm run build
node -e "const {buildOpencodeArgs}=require('./dist/tools'); console.log(buildOpencodeArgs('x; echo hacked'))"
# ['run','--','x; echo hacked']
command -v opencode
```

**Prompt:**
> Do Step 3 of NEXT_STEPS.md. Replace shell-string execution with an argument array and use the real `opencode run` subcommand.

**Commit:** `fix(tools): use opencode run with argv`

---

### Step 4. Update every `@file` and infer extensions (A3, A4)

**Files:** `src/builder/index.ts`

**Tasks:**

- Remove the early `return` inside the `@file` loop. Collect all edits, sum `tokensUsed`, and return them together.
- Make extraction strict: return only fenced code. If no code block is found, retry once with an explicit "return only one fenced code block" instruction, then throw `HageezError('NO_CODE_BLOCK')`.
- If any referenced file fails extraction, write nothing; no partial writes.
- Infer the extension from `ProjectContext.language`:
  `TypeScript→ts`, `JavaScript→js`, `Python→py`, `Java→java`, `Go→go`, `Rust→rs`, `C#→cs`, `PHP→php`, `Ruby→rb`, `Swift→swift`, `Kotlin→kt`, `Dart→dart`.
- When no `@file` is present: use `<slug>.<ext>` if the language is known. If unknown, make one separate model call asking for a relative path; validate it with the Step 2 path helper. If no valid path is returned, throw `HageezError('INVALID_PATH')`.
- Add an optional `call = callLLM` parameter to `createBuilder(config, call?)` for deterministic tests; default behavior unchanged.

**Done when:** a task with three `@file` references produces three file changes. Step 8 adds the deterministic test.

**Prompt:**
> Do Step 4 of NEXT_STEPS.md in `src/builder/index.ts`.

**Commit:** `fix(builder): update all file refs and infer extensions`

---

### Step 5. Add a diff and approval gate (A1, B5)

**Files:** `src/builder/index.ts`, `src/commands/build.ts`, `src/ui/diff.ts` (currently dead, reuse it), `src/index.ts`

**Tasks:**

- Extend `ui/diff.ts` with a simple line diff: create, update, delete; unified-style headers; cap very large files.
- Add `--yes` and `--dry-run` to `build`.
- Before any write or delete, preview every file. Prompt per file with `y` / `n` / `a` (all). Empty input means `n`.
- `--yes` writes all without prompting. If stdin is not a TTY and neither `--yes` nor `--dry-run` is set, refuse and write nothing.
- `--dry-run` shows diffs, does not prompt, does not write/delete, does not create backups, does not create `ai-learning/`, and does not log a session.
- After approval, back up existing update/delete targets to `ai-learning/backups/<timestamp>/<relativePath>`. Never back up outside the project root.
- Diff contents are terminal-only; never persist or log them.

**Done when:** `hageez build --dry-run "task"` changes no target files and creates no `ai-learning/` directory; a normal build asks before the first write.

**Prompt:**
> Do Step 5 of NEXT_STEPS.md. Reuse the existing dead `ui/diff` module where it fits.

**Commit:** `feat(build): add diff preview and approval gate`

**After Step 5:** run `git diff` and review everything Phase 0 changed.

---

## Phase 1: Correctness

### Step 6. Make the pipeline and UI truthful (A5, A6, A14, E5)

**Files:** `src/commands/build.ts`, `src/index.ts`, `src/ui/startup.ts`, `src/ui/dashboard.ts`, `src/ui/theme.ts`, `src/core/types.ts`, `src/memory/index.ts`, `package.json`

**Tasks:**

- Remove "Committing & documenting" from the pipeline. Renumber to six real steps:
  1. Scan project and collect context
  2. Understand request
  3. Create execution plan
  4. Generate/modify code
  5. Apply changes
  6. Review and refine
- Move `scanProject`, `parseFileReferences`, and `buildFileContext` into the context step. Do not leave a step that only delays.
- Remove `--tdd` and `--prd` from `build` and `BuildOptions`; remove the TDD print. Keep `plan --prd`.
- Remove all artificial delays in `build.ts`; record actual per-step elapsed times.
- Remove the hardcoded `Context: 128k` claim.
- Compute startup status from real state:
  - Config present and key configured (no network).
  - Git repo detected via `.git`.
  - `ai-learning/` present.
  - Project loaded via a scan passed from `src/index.ts`.
  - Memory: project Decisions and candidate skills; RAG: `off (not implemented)`.
  - Animate/check based on the real boolean, never always `✔`.
- Change `SessionLog`:
  - `outcome: 'success' | 'partial' | 'failed'`; retain `'error'` for old logs.
  - Add optional `error?: string`.
- On a thrown build, log a failed session with actual step statuses, `outcome: 'failed'`, and the error. A session-log failure must not hide the build error.
- On write errors, log `partial` and render a warning summary, not success.
- Read the version from `package.json` in one place:
  - Add `src/core/version.ts` with `getVersion()` reading `../../package.json` relative to `__dirname`; fallback `0.0.0`.
  - `src/ui/theme.ts` exports `VERSION = getVersion()`.
  - Keep `package.json:3` as the only version source.

**Done when:**

```bash
grep -rn "setTimeout\|sleep" src/commands/build.ts   # no fake delays
grep -n "Committing" src/commands/build.ts           # no step 7
npm run lint && npm run build
# Force a failing build, then inspect ai-learning/session_logs:
# new entry has outcome:'failed' and error
```

**Prompt:**
> Do Step 6 of NEXT_STEPS.md.

**Commit:** `refactor(build): make pipeline and startup truthful`

---

### Step 7. Provider hardening (B2, E4, A13)

**Files:** `src/core/llm/*.ts`, `src/core/types.ts`, `src/core/config.ts`

**Tasks:**

- Add `timeoutMs?: number` to `HageezConfig`; default `60000` for cloud. Old configs fall back at call time.
- Add optional abort support: `callLLM(config, messages, options?: { signal?: AbortSignal })`; pass through providers.
- Add shared retry with max 3 attempts (2 retries) for 429, 5xx, and connection timeouts. Use exponential backoff with jitter; do not retry `AUTH`.
- Set SDK clients to `timeout: config.timeoutMs ?? 60000` and `maxRetries: 0` so retries happen in one place.
- Pass `temperature: config.temperature` in the Anthropic provider.
- Add `mapProviderError(provider, err)`:
  - `401/403` → `AUTH`
  - `429` → `RATE_LIMIT`
  - timeout/abort → `TIMEOUT`
  - `5xx`/other transport → `PROVIDER`
  - Preserve existing empty-response codes.
- Return token usage whenever the provider reports it. Never include API keys or request bodies in errors.

**Done when:** a bad API key produces `HageezError` with code `AUTH`, not a stack trace, and no key appears in output.

**Prompt:**
> Do Step 7 of NEXT_STEPS.md.

**Commit:** `fix(llm): add timeouts retries and error mapping`

---

### Step 7a. Connections and Ollama (local models)

**Why:** Users must connect local Ollama models and cloud API keys, then assign them to agents. Today config holds one provider and one key.

**Files:** `src/core/config.ts`, `src/core/types.ts`, `src/core/llm/` (new `ollama.ts`, new `registry.ts`), new `src/commands/connect.ts`, new `src/commands/models.ts`, `src/commands/doctor.ts`

**Tasks:**

- **Config v2:** replace the single provider/key with named connections:

```json
{
  "version": 2,
  "connections": {
    "local": { "type": "ollama", "baseUrl": "http://localhost:11434" },
    "groq":  { "type": "groq", "apiKeyEnv": "GROQ_API_KEY" }
  },
  "defaultModel": { "connection": "groq", "model": "llama-3.3-70b-versatile" },
  "agents": {}
}
```

- Supported `type`: `openai`, `anthropic`, `grok`, `groq`, `ollama`, `openai-compatible` (custom `baseUrl`).
- **Migration:** on load, convert a v1 config (`provider`, `model`, `apiKey`) into one connection plus `defaultModel`. Keep a backup `config.v1.json` with mode `0600`. Existing users must not lose their setup.
- **Keys:** prefer `apiKeyEnv` (name of an environment variable). If the user types a key, store it in the config at `0600` under Step 1 rules. Never print keys. Ollama needs no key.
- **Ollama provider (`ollama.ts`):**
  - Base URL: connection `baseUrl`, then `OLLAMA_HOST`, then `http://localhost:11434`.
  - Chat through `POST /api/chat` with `stream: false`. List models with `GET /api/tags`.
  - Timeout default 300 s for local models; cloud stays at 60 s.
  - If Ollama is not running: `PROVIDER_UNREACHABLE`, telling the user to run `ollama serve`.
  - If the model is not pulled: `MODEL_NOT_FOUND`, telling the user to run `ollama pull <model>`.
- **Model kinds:** tag each model `chat` or `embedding` using `/api/show` capabilities, falling back to a name check such as `embed`. Embedding models (for example `nomic-embed-text`) can never be assigned to an agent; reserve them for RAG and memory search.
- **Concurrency limit per connection:** `maxConcurrent`, default `1` for Ollama and `3` for cloud. Step 12 must respect it.
- **Commands:**
  - `hageez connect add <name>` (interactive: type, base URL if needed, key or env var name, masked input)
  - `hageez connect list | test <name> | remove <name>`
  - `hageez models [connection]` lists live models (Ollama from `/api/tags`; cloud from a built-in list the user can override)
- **Doctor:** show each connection, reachable or not, and how many agents use it.

**Done when:** With Ollama running, `hageez connect add local --type ollama`, then `hageez connect test local` lists `llama3.2:3b` as chat and `nomic-embed-text` as embedding. A `callLLM` through `local` / `llama3.2:3b` returns text. Stopping Ollama gives the `PROVIDER_UNREACHABLE` message, not a stack trace. A v1 config upgrades without losing the key.

**Prompt:**
> Do Step 7a of NEXT_STEPS.md. Build config v2 with named connections, the Ollama provider, the connect and models commands, and v1 migration. Do not change any agent behavior yet.

**Commit:** `feat(config): add named connections and Ollama provider`

---

### Step 8. Tests and CI (E6)

**Files:** new `test/`, `tsconfig.test.json`, `package.json`, `.gitignore`, `.github/workflows/ci.yml`

**Tasks:**

- Add `node:test`; compile tests with `tsconfig.test.json` into `dist-test/`.
- Add scripts:

```json
"build:test": "tsc -p tsconfig.test.json",
"test": "npm run build:test && node --test dist-test/test",
"lint": "tsc --noEmit && tsc -p tsconfig.test.json --noEmit"
```

- Add `dist-test/` to `.gitignore`.
- Tests:
  - `@file` parser (explicit, bare, start-of-input, unresolved).
  - Builder extraction and retry/failure.
  - Builder multi-file and extension inference (injected fake `callLLM`).
  - Path containment (`../../x`, absolute outside, `.git`, `node_modules`, valid inside, symlink escape if supported).
  - Config mode `0600`/directory `0700` and env overrides (temp `HOME` child process; never print keys).
  - Scanner on a fixture folder.
  - Provider error mapping and retry behavior without network.
- CI: Node 22.12, `npm ci`, `npm run lint`, `npm run build`, `npm test`.

**Done when:** `npm test` passes and covers the Step 2 and Step 4 fixes.

**Prompt:**
> Do Step 8 of NEXT_STEPS.md. Do not change source behavior; only add tests and a minimal seam if something cannot be tested.

**Commit:** `test: add node:test suite and CI`

---

### Step 9. Fix the docs and the Node floor (A20, A26, Section 7 corrections)

**Files:** `AI_PLAN/WHATS_LEFT.md`, `AGENTS.md`, `CONTEXT.md`, `docs/adr/0001-*.md`, `docs/adr/0003-*.md`, `package.json`, `package-lock.json`, `src/commands/doctor.ts`, new `README.md`, new `LICENSE`

**Tasks:**

- Apply every correction from `AUDIT_REPORT.md` Section 7:
  - `WHATS_LEFT`: inquirer is CJS; dist is current; docs work has started.
  - `AGENTS`: inquirer; `HageezError` is not universal; theme helpers are not universal.
  - `ADR-0001`: only `chalk@5` is ESM-only; inquirer ships CJS.
  - `CONTEXT`: File Reference is Build-only; Session Log excludes thrown failures; REPL History excludes slash commands; Memory is not reused; Decisions are not written.
- Confirm the runtime floor: `engines.node = ">=22.12.0"`. Update `package-lock.json` root engines, `doctor` Node check/message, and ADR-0001.
- Update ADR-0003 to record that the `Sandbox: Enabled` claim was removed while direct writes remain the v1 model.
- Add `LICENSE` (MIT, author from `package.json`, year 2026).
- Add `README.md` with install/run, an as-built vs planned table, a security note, and local dev commands.
- Update `WHATS_LEFT.md` to mark Steps 0-8 (including 7a) done; Phase 2-4 still pending.

**Done when:** no document claims something the audit disproved; `grep` for the stale claims is clean apart from intentional historical references.

**Prompt:**
> Do Step 9 of NEXT_STEPS.md using Section 7 of AUDIT_REPORT.md as the exact edit list.

**Commit:** `docs: correct claims and raise Node floor`

**Phase 0/1 gate:** all Phase 0 and Phase 1 commits exist; `npm test` passes; `git status` is clean.

---

## Phase 2: Agent foundation

Do not start Phase 2 until Phase 0 and Phase 1 are committed and `npm test` passes.

### Step 10. Agent runtime

**Files:** new `src/agents/`

**Tasks:**

- Define an `Agent` type: `name`, `role`, `systemPrompt`, optional connection/model override, `inputs`, `outputs`, `allowedTools`.
- Define `AgentResult`: `{ agent, status, artifacts[], tokens, error? }`.
- Add `runAgent(agent, input)` using `callLLM`, with the timeout and retry behavior from Step 7.
- Use the Step 7a config: `defaultModel` is the fallback; per-agent assignment is added in Step 10a.
- Add `hageez agent run <name> "task"`.

**Done when:** one trivial agent runs via `hageez agent run analyst "task"` and returns an `AgentResult` using `defaultModel`.

**Prompt:**
> Do Step 10 of NEXT_STEPS.md. Create the runtime only; do not port existing steps yet.

**Commit:** `feat(agents): add agent runtime`

---

### Step 10a. Assign models to the ten agents

**Why:** The user decides which model runs each agent: one source for everything, two sources, or any mix, and can reassign at any time.

**Files:** `src/agents/`, `src/core/config.ts`, new `src/commands/assign.ts`, `src/commands/build.ts`, `src/commands/doctor.ts`

**Tasks:**

- **Agent registry** with these ten ids: `analyst`, `product-brief`, `pm`, `ux-designer`, `architect`, `project-context`, `build`, `code-review`, `qa-tests`, `retrospective`.
- **Resolution order** for each run: CLI override `--agent-model <agent>=<connection>:<model>`, then `config.agents[<agent>]`, then `config.defaultModel`.
- **Commands:**
  - `hageez assign` (interactive: pick agent, then connection, then model)
  - `hageez assign <agent> <connection>:<model>`
  - `hageez assign --all <connection>:<model>`
  - `hageez assign --preset local | cloud | mixed`
  - `hageez assign show` (table of agent, connection, model, status) and `hageez assign reset`
- **Presets:** `local` assigns every agent to the chosen Ollama chat model. `cloud` assigns every agent to the default cloud model. `mixed` puts light agents (`analyst`, `product-brief`, `pm`, `retrospective`) on local and heavy agents (`architect`, `build`, `code-review`, `qa-tests`, `ux-designer`, `project-context`) on cloud.
- **Validation on assign:**
  - Refuse embedding models.
  - Warn (do not block) when a model of 3B parameters or fewer is given to `architect`, `build`, or `code-review`.
  - Warn when the connection is unreachable or the key variable is empty.
- **Before every run** (and in `--dry-run`), print the agent-to-model table and the connections in use.
- **Doctor:** list agents whose assigned connection is unreachable.

**Done when:** `assign --preset mixed` sets the split above; `assign architect groq:llama-3.3-70b-versatile` changes only the architect; `assign show` prints all ten rows; assigning `local:nomic-embed-text` to any agent is refused; running with an unreachable connection fails before any agent starts.

**Prompt:**
> Do Step 10a of NEXT_STEPS.md. Build the agent-to-model assignment on top of the connections from Step 7a and the runtime from Step 10.

**Commit:** `feat(agents): add per-agent model assignment`

---

### Step 11. Artifact store

**Files:** new `src/artifacts/`

**Tasks:**

- Store each agent output under `ai-learning/runs/<run-id>/<agent>.md` plus a `run.json` manifest (inputs, outputs, status, timestamps, model).
- API: `writeArtifact`, `readArtifact`, `listArtifacts(runId)`.
- Validate paths; write atomically.
- Agents receive upstream artifacts as input, not chat history.

**Done when:** two agents run in sequence and the second reads the first's file.

**Prompt:**
> Do Step 11 of NEXT_STEPS.md.

**Commit:** `feat(artifacts): add run artifact store`

---

### Step 12. Orchestrator

**Files:** new `src/orchestrator/`

**Tasks:**

- Define a pipeline as a dependency graph (`id`, `agent`, `dependsOn[]`); reject cycles.
- Run nodes whose dependencies are done in parallel with `Promise.allSettled`; cap concurrency (default 3).
- Respect each connection's `maxConcurrent` from Step 7a. Agents on the same single-slot Ollama connection queue; parallel speed-up comes from different connections.
- On a failed node, mark dependents `skipped` and continue independent branches.
- **Single writer rule:** only the `build` agent may write project files; all other agents write artifacts only.
- Print live progress per agent.

**Done when:** a test graph `A -> (B, C parallel) -> D` runs B and C concurrently and D after both.

**Prompt:**
> Do Step 12 of NEXT_STEPS.md. Add unit tests for ordering, parallelism, and failure propagation.

**Commit:** `feat(orchestrator): add dependency graph runner`

---

## Phase 3: Learning loop

### Step 13. Memory recall (A15, D2)

**Files:** `src/memory/index.ts`, `src/core/llm/client.ts`, callers of `buildSystemPrompt`

**Note:** `nomic-embed-text` is reserved for later memory and RAG search. Step 13 uses plain keyword matching and needs no embeddings.

**Tasks:**

- Make `recallDecision` return all Decisions for the project (and a relevance filter by keyword).
- Inject recalled Decisions into the system prompt for every agent through one `projectContext` builder.
- Add `hageez memory list | add | remove` commands.
- The debug flag prints only decision metadata, never file contents.

**Done when:** a Decision added with `hageez memory add` appears in the next agent's prompt (verify with the debug flag without calling the model).

**Prompt:**
> Do Step 13 of NEXT_STEPS.md.

**Commit:** `feat(memory): wire decision recall into prompts`

---

### Step 14. Skills loader (A18, D4)

**Files:** `src/core/llm/client.ts`, `src/core/types.ts`, `src/commands/init.ts`

**Tasks:**

- Define a skill as a markdown file with frontmatter (`name`, `description`, `appliesTo`) in `ai-learning/skills/` (project) and `~/.hageezai/skills/` (global).
- Load matching skills and pass them to `buildSystemPrompt` instead of `''`.
- Add `hageez skills list | add | enable | disable`.

**Done when:** a skill file's content appears in the prompt of the agent it applies to.

**Prompt:**
> Do Step 14 of NEXT_STEPS.md.

**Commit:** `feat(skills): load project and global skills`

---

## Phase 4: Convert and add agents

For each agent: write its system prompt, its input and output artifact, one test, then commit. Do one per session.

### Step 15. Port the existing pipeline into agents

| Order | Agent | Reuses | Output artifact |
|---|---|---|---|
| 15a | `analyst` | scanner + intent step | `analysis.md` (requirements, MVP scope) |
| 15b | `pm` | `src/planner` | `plan.md` with task list and dependencies |
| 15c | `build` | `src/builder` + approval gate | file changes + `changes.md` |
| 15d | `code-review` | `src/reviewer` | `review.md` with structured `issues`; send back to `build` if severity is high (max 2 loops) |

Fix from audit F2: the reviewer must review the **actual diff** (including new files), and `review.issues` must be consumed.

**Prompt:**
> Do Step 15a of NEXT_STEPS.md. Wrap the existing scanner and intent code as the `analyst` agent and run it through the orchestrator. Behavior of `hageez build` must stay the same.

Repeat for 15b, 15c, 15d.

**Commits:** one per sub-step, e.g. `feat(agents): port analyst`, `feat(agents): port pm`, etc.

---

### Step 16. New agents

| Order | Agent | Notes |
|---|---|---|
| 16a | `product-brief` | Replaces the fake `grill`: asks Socratic questions, then writes `brief.md` |
| 16b | `architect` | Reads brief and analysis; writes `design.md` and drafts ADRs into `docs/adr/` (draft status) |
| 16c | `ux-designer` | Runs only when the scanner detects a frontend framework or the Task mentions UI |
| 16d | `project-context` | Gatekeeper: merges outputs of `pm`, `architect`, `ux-designer`, resolves conflicts, injects Decisions and skills |
| 16e | `qa-generate-e2e-tests` | Generates tests, detects the project's test command, runs it, reports pass/fail |
| 16f | `retrospective` | Reads the run manifest and session log; writes Decisions and candidate skills to memory (closes the learning loop) |

**Prompts:** one agent per session, same pattern as 15a. Each adds one test and one commit.

---

### Step 17. Final pipeline

```text
analyst -> product-brief
        -> [pm | ux-designer | architect]   (parallel)
        -> project-context                  (merge)
        -> build                            (single writer, approval gate)
        -> [code-review | qa-tests]         (parallel)
        -> retrospective
```

**Done when:** `hageez build "task"` runs this graph end to end, writes artifacts under `ai-learning/runs/<id>/`, and `retrospective` adds at least one Decision to memory that the next run recalls.

**Commit:** `feat(build): run the full agent pipeline`

---

## Progress checklist

- [x] 0 git baseline
- [x] 1 config security
- [x] 2 path containment + sandbox claim removed
- [x] 3 `--via-opencode` fixed
- [x] 4 all `@file`s + extensions
- [x] 5 diff and approval gate
- [x] 6 truthful pipeline and UI
- [x] 7 provider hardening
- [x] 7a connections + Ollama + config v2
- [x] 8 tests + CI
- [x] 9 docs and Node floor
- [x] 10 agent runtime
- [x] 10a assign models to the ten agents
- [x] 11 artifact store
- [x] 12 orchestrator
- [x] 13 memory recall
- [x] 14 skills loader
- [x] 15a-d port existing steps into agents
- [x] 16a-f new agents
- [x] 17 final parallel pipeline

## Handoff protocol

For every step:

1. Start from a clean `git status`.
2. Do only the named step; if the code differs from this file, stop and report.
3. Run `npm run lint && npm run build`; from Step 8 also `npm test`.
4. Run the step's "Done when" check.
5. Commit only that step's files with the stated message.
6. Report files changed with `file:line`, commands and output, acceptance result, and anything left undone.
