# 06 — Diff approval, backups, and dry-run

**What to build:** Before a Build writes or deletes anything, the user sees a diff for every affected file and can approve one file, reject it, or approve all. `--yes` and `--dry-run` support non-interactive use, unsafe non-TTY writes are refused, and existing files are backed up inside the project before mutation.

**Blocked by:** 03 — Contained write path and truthful write claim; 05 — Multi-file Build edits and extension inference.

**Status:** resolved

**Covers:** NEXT_STEPS Step 5.

- [x] `--dry-run` shows diffs and creates no target changes, backups, `ai-learning/`, or Session Log.
- [x] A normal Build previews every file before the first write and prompts per file with yes, no, or all; empty input means no.
- [x] `--yes` writes all files without prompting.
- [x] A non-TTY Build without `--yes` or `--dry-run` refuses and writes nothing.
- [x] Existing update/delete targets are backed up inside the project; no backup is written outside it.
- [x] Diff text is terminal-only and is never persisted or logged.
- [x] Tests cover all, partial, reject, dry-run, non-TTY, and backup behaviour.

## Comments

- 2026-10-24: Implemented in Story 1. `npm run lint`, `npm test` (58 tests), and `npm run build` pass.
