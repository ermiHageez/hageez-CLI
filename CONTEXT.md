# HageezAI

HageezAI is an AI software engineering assistant that runs as a command-line tool inside an existing project: it inspects the project, plans a task, generates or edits code, reviews the result, and records the run locally. This context covers the HageezAI CLI itself and the vocabulary of the projects it operates on.

## Language

### Product

**HageezAI**:
The product and assistant identity, used for branding, prompts, and documentation.
_Avoid_: Hageez, the AI, the platform

**hageez**:
The command-line executable provided by the `hageezai-cli` package; the command users type.
_Avoid_: HageezAI CLI, hageezai-cli (package name)

### Work

**Task**:
A user-authored request describing an engineering change, passed to Build, Plan, or the REPL.
_Avoid_: prompt, ticket, issue, request

**Build**:
The operation that runs the full pipeline for a Task and may write files.
_Avoid_: run, execution, pipeline

**Plan**:
The operation that produces an execution plan, PRD, or ticket breakdown without writing files.
_Avoid_: planning session, design

**Build Mode**:
The REPL mode in which a bare line is executed as a Build.
_Avoid_: build (alone when the mode is meant)

**Plan Mode**:
The REPL mode in which a bare line is executed as a Plan.
_Avoid_: plan (alone when the mode is meant)

**Chat**:
An interactive question-and-answer session that does not write files.
_Avoid_: conversation, assistant session

### Models

**Provider**:
The vendor or runtime serving a language model: OpenAI, Anthropic, xAI (Grok), Groq, an OpenAI-compatible endpoint, or local Ollama.
_Avoid_: backend, API, engine

**Connection**:
A named Provider configuration with its endpoint, credential reference, timeout, concurrency, and model catalog.
_Avoid_: provider entry, account

**Model**:
The specific model identifier sent to a Provider, such as `gpt-4o`.
_Avoid_: LLM, engine

**Agent**:
One of the ten specialist roles in the Build graph: analyst, product-brief, pm, ux-designer, architect, project-context, build, code-review, qa-tests, or retrospective.
_Avoid_: bot, persona, worker

**Run**:
One execution of a pipeline, recorded as a manifest plus Agent artifacts under `ai-learning/runs/`.
_Avoid_: job, build attempt

**Artifact**:
An Agent's persisted output for a Run.
_Avoid_: output file, result

**Project Context**:
The metadata produced by scanning a project: name, language, framework, database, build tool, branch, and file, line, and dependency counts.
_Avoid_: context, project info, repo info

### Inputs and records

**File Reference**:
An `@path` token in a Task that embeds the referenced file's contents into the request.
_Avoid_: attachment, mention, file input

**ai-learning**:
The gitignored directory inside a target project that holds its Session Logs, Memory, datasets, embedding placeholders, and exports.
_Avoid_: learning folder, data dir, .hageezai

**Session Log**:
The persisted record of one Build attempt in a project's ai-learning directory.
_Avoid_: session, run log, history

**Chat History**:
The in-memory message list of a single Chat; it is not persisted.
_Avoid_: session, conversation log

**REPL History**:
The persisted list of lines entered in the interactive shell.
_Avoid_: command history, session history

**Memory**:
Project-level knowledge stored under ai-learning for reuse across Builds.
_Avoid_: cache, store, context

**Decision**:
A named entry in Memory recording a chosen convention or approach.
_Avoid_: memory item, note, rule

**Skill**:
A project or global instruction file that applies to named Agents and is injected into their prompts.
_Avoid_: plugin, extension, rule
