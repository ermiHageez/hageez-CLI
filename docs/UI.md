# HageezAI Full-Screen CLI Terminal Interface

HageezAI features a full-screen terminal interface (TUI) powered by an in-house zero-dependency ANSI buffer renderer running in the alternate screen buffer (`\x1b[?1049h`).

```text
+---------------------------------------------+------------------------+
| header: run name                branch      |  [robot] HAGEEZ AI     |
|---------------------------------------------|  session title         |
| feed: user messages, agent progress,        |  context, cost         |
|       tool/test output, diffs               |  Agents  7 of 10 done  |
|                                             |  [sprite] analyst  12s |
|   +-----------------------------+           |  [sprite] pm       41s |
|   | /help    ...                |           |  [sprite] qa-tests  *  |  <- animated
|   | /assign  ... (selected)     |           |  ...                   |
|   +-----------------------------+           |  path, branch, version |
| > /_   (input)                              |                        |
| Build mode . model . HageezAI               |                        |
| esc interrupt  tab build/plan   ctrl+p      |                        |
+---------------------------------------------+------------------------+
```

## Keybindings & Shortcuts

| Key | Action |
|---|---|
| `Tab` | Toggle between **Build mode** and **Plan mode** |
| `/` | Open the interactive slash command menu (filters as you type) |
| `@` | Open the fuzzy project file picker |
| `Esc` | Interrupt a running build pipeline via abort signal, or close open popups |
| `ctrl+b` | Toggle the right-hand agent sidebar |
| `ctrl+p` | Open the command palette |
| `Shift+Enter` | Insert a newline for multi-line input prompts |
| `Up` / `Down` | Navigate command history (or browse items when popup menu is open) |
| `Ctrl+C` | Cleanly exit alternate buffer and restore the terminal |

## Breakpoints & Responsiveness

The TUI automatically detects terminal dimensions via `SIGWINCH` and adapts without flickering:

1. **Desktop ($\ge 120$ columns $\times$ 40 rows)**:
   - Full 2-column layout.
   - Fixed 40-column right sidebar.
   - 8$\times$3 half-block (`▀`) truecolor robot sprites for all 10 agents.
   - Active working agent animates at 4 FPS (alternating body-up and body-down frames).
2. **Compact ($100$ to $119$ columns, or $< 40$ rows)**:
   - Compact sidebar with 1-line agent rows.
   - Colored 3-character badges (e.g. `[ANA]`, `[PM ]`, `[BLD]`, `[REV]`) replace large sprites.
3. **Narrow ($< 100$ columns)**:
   - Single-column scrolling feed and input.
   - Sidebar is hidden by default and can be toggled in and out with `ctrl+b`.

## The 10 Pipeline Agents

The sidebar displays the live status of the 10 canonical agents in the HageezAI graph:

| Order | Agent | Default Model | Description |
|---|---|---|---|
| 1 | `analyst` | `openai:gpt-4o` | Scans project structure, language, and repository intent |
| 2 | `product-brief` | `anthropic:claude-3-5-sonnet` | Socratic requirement clarification and brief synthesis |
| 3 | `pm` | `anthropic:claude-3-5-sonnet` | Execution planning and ticket breakdown |
| 4 | `ux-designer` | `openai:gpt-4o` | Wireframe design and UI layout validation |
| 5 | `architect` | `anthropic:claude-3-5-sonnet` | Technical design, ADR drafting, and system contracts |
| 6 | `project-context` | `anthropic:claude-3-5-sonnet` | Gatekeeper merging upstream briefs, plans, and skills |
| 7 | `build` | `anthropic:claude-3-5-sonnet` | Single authorized code writer producing targeted file changes |
| 8 | `code-review` | `anthropic:claude-3-5-sonnet` | Diff inspection against architectural standards |
| 9 | `qa-tests` | `local:qwen2.5-coder:7b` | Test generation and automated test suite verification |
| 10 | `retrospective` | `local:llama3.2:3b` | Writes learned Decisions and candidate skills to memory |

Agent row states:
- `✔ 12s`: Completed successfully with recorded elapsed runtime.
- `● 14s`: Active working agent with highlighted cyan selection border and animated robot sprite.
- `waiting`: Upstream dependency is not finished yet (dimmed).
- `skipped`: Optional step or cancelled by dependency failure.
- `failed`: Execution failed with error recorded.

## In-TUI Diff Approval Modal

Before any target file is modified on disk:
- The diff modal appears over the feed with syntax-highlighted diffs (`+` green, `-` red).
- Keys:
  - `[y]`: Approve the current file.
  - `[n]`: Reject the current file (leaves file untouched).
  - `[a]`: Approve all remaining files.
  - `Enter`: Defaults to rejection (`n`) for safety.
- Backups are stored under `ai-learning/backups/<timestamp>/`.

## Environment Flags

- `--no-tui`: Disables the full-screen TUI and falls back to the classic line-based REPL. Automatically active in CI and non-TTY environments.
- `NO_COLOR=1`: Disables ANSI colors and switches sprites to monochrome badges.
- `HAGEEZ_NO_ANIM=1`: Disables robot bobbing animations.
