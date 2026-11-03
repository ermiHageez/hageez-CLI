# HageezAI: Build the full-screen CLI interface

Give opencode this file plus two images. Copy them into the repo first:

- `docs/design/cli-layout.png` (the agreed layout, from `cli-layout.png`)
- `assets/agents/agent-sprites.png` (the robot sprite sheet, from `agent-sprites.png`)

## Rules (same as NEXT_STEPS.md)

1. One ticket per session. Do only that ticket; do not touch unrelated files.
2. Run `npm run lint && npm run build && npm test` before finishing. All must pass.
3. Cite `file:line` for every change. If the code differs from this file, stop and report.
4. Never log or print API keys or file contents. Diffs are shown to the user only, never persisted.
5. Commit only that ticket's files with the stated message. Start from a clean `git status`.
6. No new runtime dependency without an ADR (`docs/adr/0004-*`). Keep CommonJS and Node >=22.12.
7. Every status shown on screen must come from real state. Never show a green check for something not built.

## Goal

Replace the line-based REPL with a full-screen terminal interface that matches `docs/design/cli-layout.png`:

```
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
| Build . model . HageezAI                    |                        |
| esc interrupt  tab build/plan   ctrl+p      |                        |
+---------------------------------------------+------------------------+
```

The user must always see which agent is working and on which model. The working agent's robot animates; finished agents show a check and time; waiting agents are dimmed.

## Layout spec

| Part | Behavior |
|---|---|
| Screen | Alternate screen buffer, full width and height, restored on exit and on crash. Redraw on resize. |
| Sidebar | Fixed 40 columns on the right. Order: logo, session title, context and cost, `Agents n of 10 done`, ten agent rows, bottom block (project path, branch, version). |
| Logo | The HAGEEZ AI logo at the very top of the sidebar, with a small robot sprite beside it. |
| Agent row | Sprite, name, `connection . model`, right-aligned state: `check 12s` done, `working`, `waiting`, `skipped, <reason>`, `failed`. Working row has a highlighted border. |
| Header | Run id left, project and branch right. |
| Feed | Scrolling list of blocks: user message (amber left bar), run-start line, agent progress block, test or command output block, diff block. Scroll with PageUp/PageDown and the mouse wheel when supported. |
| Slash menu | Opens above the input when the line starts with `/`. Filters as you type. Up/Down select, Enter runs, Tab completes, Esc closes. |
| Input | Left bar in green, multi-line with Shift+Enter, history with Up/Down when the menu is closed. Under it: mode (`Build` or `Plan`), the model that mode uses, `HageezAI`. |
| Footer | Left: `esc interrupt  tab build/plan  @ files`. Right: tokens used and percent, `ctrl+p commands`. |
| Breakpoints | At least 120 columns by 40 rows: full layout with sprites. 100 to 119 columns, or fewer than 40 rows: compact sidebar with one-line agent rows and a colored badge instead of the sprite. Under 100 columns: sidebar hidden, toggle with `ctrl+b`. |

Colors (truecolor; map to 256 and 16 colors; honor `NO_COLOR`): background `#0e1116`, sidebar `#0a0d12`, panel `#151a22`, text `#d8dee9`, dim `#8b96a5`, green `#3ddc84`, amber `#f0b429`, blue `#6cb6ff`, red `#ff7b72`, selection `#1f3a5f`.

Note: the layout image shows "Switch to Plan node". That is a typo. Use "Plan mode".

## Sprites

- The sheet `assets/agents/agent-sprites.png` has 13 robots. Map them in `src/ui/sprites/map.json`: analyst, product-brief, pm, ux-designer, architect, project-context (magnifier robot, as in the layout image), build, code-review, qa-tests, retrospective. The first "Agent" robot is used beside the logo. The goggles-and-blueprint robot and the unlabeled robot are reserved; do not show them yet.
- Convert each sprite to a small pixel grid at build time with a script (`scripts/make-sprites.ts`, output committed as JSON). Render with half-block characters (`▀`) using foreground and background truecolor, about 8 columns by 3 lines.
- Two frames per working agent (body up, body down) at about 4 frames per second. Idle and done agents use the still frame; waiting agents are dimmed.
- Fallbacks: 256-color, then a 3-character colored badge such as `QA `. `HAGEEZ_NO_ANIM=1` or `NO_COLOR` disables animation.

## Tickets

### U0. Spike and decision (ADR-0004)

Prove, in a throwaway folder `spike/`, a full-screen layout with a right sidebar, a scrolling feed, a text input, and flicker-free redraw on resize. Compare at least: (a) Ink loaded with dynamic `import()` from CommonJS, (b) neo-blessed, (c) a small own ANSI renderer. Judge by: works from this CommonJS build, no top-level-await problems, flicker, resize, wide characters, bundle size, test friendliness. Write `docs/adr/0004-terminal-ui-library.md` with the choice. Do not change product code.
**Done when:** the ADR exists and the chosen spike runs `node spike/run.js` on Node 22.12+.
**Commit:** `docs(adr): choose terminal UI approach`

### U1. Event bus and UI state (no drawing)

Add `src/ui/events.ts` with typed events: `run:start`, `agent:start`, `agent:done`, `agent:failed`, `agent:skipped`, `usage` (tokens, cost), `feed:block`, `approval:request`. Make the orchestrator and runtime emit them. Add a pure reducer `src/ui/state.ts` that turns events into the sidebar and feed state. No rendering yet.
**Done when:** unit tests feed a fake event stream and assert the state for a run like the layout image (7 done, 1 working, 1 skipped, 1 waiting).
**Commit:** `feat(ui): add event bus and ui state reducer`

### U2. Layout shell

Draw header, feed, input, footer and the sidebar frame with logo and bottom block, with the breakpoints above. Keep the old REPL behind `--no-tui` and use it automatically when stdout is not a TTY or `CI` is set.
**Done when:** `hageez` opens the full-screen layout; resize redraws without flicker; Ctrl+C restores the terminal; snapshot tests render 120x40 and 100x30 from fixed state.
**Commit:** `feat(ui): add full-screen layout shell`

### U3. Sidebar agents

Render ten agent rows from state: name, connection and model from the real assignment table, elapsed time, states, highlighted working row, and `Agents n of 10 done`. Add the compact mode.
**Done when:** a dry run drives the sidebar through all states; snapshot tests cover full and compact modes.
**Commit:** `feat(ui): render agent rows in sidebar`

### U4. Sprites

Add `scripts/make-sprites.ts`, `src/ui/sprites/` with generated JSON and the renderer, animation for the working row, and the fallbacks.
**Done when:** each of the ten agents renders as a recognizable sprite; the working agent alternates frames; `NO_COLOR` and `HAGEEZ_NO_ANIM=1` show badges and no motion; a test checks the converter output size and palette.
**Commit:** `feat(ui): add agent sprites and animation`

### U5. Slash menu and one command registry

Build one command registry used by the menu, `/help`, and `ctrl+p`. Remove the dead `slash.ts` duplication and the REPL's own list. Commands: `/help /agents /assign /connect /models /plan /build /chat /memory /skills /diff /undo /doctor`. Each maps to the real command; interactive ones (`/assign`, `/connect`) open a panel in the feed.
**Done when:** typing `/as` filters to `/assign`; Enter runs it; Esc closes; unit tests cover filtering and selection.
**Commit:** `feat(ui): add slash menu and command registry`

### U6. Input behavior

`@` opens a file picker (project files only, fuzzy filter, honors the protected-path rules). Tab toggles Build and Plan. Esc interrupts a running run through the abort signal. Up/Down history persists to REPL History. `ctrl+b` toggles the sidebar.
**Done when:** each key works in a pseudo-terminal test; interrupting stops running agents and reports which ones were cancelled.
**Commit:** `feat(ui): add file picker, mode toggle and interrupt`

### U7. Approval and feed blocks

Show the diff approval (`y`, `n`, `a`, Enter means no) as a modal over the feed. Render tool and test output, diffs and agent results as feed blocks. `--dry-run` and `--yes` behave as before.
**Done when:** all existing approval tests still pass; a TUI test approves one file and rejects another.
**Commit:** `feat(ui): approval modal and feed blocks`

### U8. Polish and truth

- Small talk and plain questions go to Chat, not Build. Build needs a clear task.
- If the folder is not a project, show "No project found here" instead of a project name.
- Remove hardcoded `128k`; show the model's real limit or nothing.
- Add `docs/UI.md` with the layout image, keys and breakpoints; update `README.md`.
**Done when:** typing `hi` does not start a Build; `npm test` passes; docs match the screen.
**Commit:** `feat(ui): route small talk to chat and finish docs`

## Handoff

For each ticket report: files changed with `file:line`, commands run with output, the "Done when" result, and anything left undone.
