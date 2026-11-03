# ADR-0005: Full-Screen Terminal UI Library Choice

## Status
Accepted

## Context
Ticket U0 requires replacing the line-based REPL in `src/ui/repl.ts` with a full-screen terminal interface featuring a 40-column right sidebar, animated sprites, scrolling feed, floating slash menu, and modal diff approval, matching `docs/design/cli-layout.png`.

We evaluated three potential implementation approaches in `spike/`:

1. **Ink (React for CLI)**:
   - *Issues*: Ink is ESM-only (`chalk@5` and `ink@4+`). Loading Ink from CommonJS requires asynchronous dynamic `import()` wrappers, complicating CLI startup and violating the synchronous Command/REPL loop. Furthermore, React's reconciliation engine introduces significant bundle weight (20+ transitive dependencies), potential memory overhead, and JSX build tool requirements.

2. **neo-blessed / blessed**:
   - *Issues*: Abandoned and unmaintained. Monkey-patches Node's standard I/O streams and causes screen-clearing flicker during resize (`SIGWINCH`) events. Does not natively support 24-bit TrueColor or Unicode half-block sprite rendering cleanly without external plugins.

3. **In-House Double-Buffered ANSI Renderer**:
   - *Advantages*: Zero new runtime dependencies (complying strictly with ADR-0001). Pure CommonJS. Sub-millisecond draw cycle. TrueColor (`\x1b[38;2;R;G;Bm`) and half-block character support (`▀`). Double-buffered terminal cell differential updates eliminate redraw flicker completely. Clean signal trapping (`SIGWINCH`, `SIGINT`, `SIGTERM`, `exit`) ensures safe restoration of the alternate screen buffer (`\x1b[?1049l`). Fully testable in `node:test` by asserting virtual screen buffer state.

## Decision
Adopt **Option 3: In-House Double-Buffered ANSI Renderer**.

The core implementation lives in `src/ui/layout.ts`, driven by a pure state reducer in `src/ui/state.ts` and an event bus in `src/ui/events.ts`.

## Consequences
- No new dependencies added to `package.json`.
- Guaranteed compatibility with Node >=22.12.0 and CommonJS output.
- Alternate buffer restoration guaranteed on crash or exit.
- Full-screen TUI runs when `process.stdout.isTTY` is true and `--no-tui` is not passed; non-TTY or CI environments cleanly fall back to line-oriented output.
