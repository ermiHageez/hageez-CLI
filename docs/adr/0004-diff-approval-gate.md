# Build previews diffs and requires approval before direct writes

Build now previews every affected file, prompts per file with `y`/`n`/`a`, supports `--yes` and `--dry-run`, refuses non-interactive writes without `--yes`, and backs up existing update/delete targets under `ai-learning/backups/`. Approved writes still go directly to the project; there is no sandbox or isolated workspace.

**Status**: accepted (Story 1, tickets 03 and 06)

**Consequences**: users can review and reject individual changes; rejected files are left untouched; backups provide rollback for updates and deletes; diff text is terminal-only and is never logged. Prompt injection can still write code after approval, so a clean VCS baseline remains the recommended safety net.

**Considered options**: no approval (superseded); full temporary-directory sandbox (deferred); automatic branch or stash before writing (deferred).
