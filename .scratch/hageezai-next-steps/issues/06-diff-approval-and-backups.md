# 06 — Diff approval, backups, and dry-run

**What to build:** Before a Build writes or deletes anything, the user sees a diff for every affected file and can approve one file, reject it, or approve all. `--yes` and `--dry-run` support non-interactive use, unsafe non-TTY writes are refused, and existing files are backed up inside the project before mutation.

**Blocked by:** 03 — Contained write path and truthful write claim; 05 — Multi-file Build edits and extension inference.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 5.

- [ ] `--dry-run` shows diffs and creates no target changes, backups, `ai-learning/`, or Session Log.
- [ ] A normal Build previews every file before the first write and prompts per file with yes, no, or all; empty input means no.
- [ ] `--yes` writes all files without prompting.
- [ ] A non-TTY Build without `--yes` or `--dry-run` refuses and writes nothing.
- [ ] Existing update/delete targets are backed up inside the project; no backup is written outside it.
- [ ] Diff text is terminal-only and is never persisted or logged.
- [ ] Tests cover all, partial, reject, dry-run, non-TTY, and backup behaviour.
