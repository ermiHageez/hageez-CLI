# Builder writes files directly; the sandbox claim was removed

The v1 trust model is direct writes: approved Build changes go straight to disk, with no isolated workspace or sandbox. The old startup and dashboard "Sandbox: Enabled" claims were false and have been removed. This decision is superseded in part by ADR-0004: Build now previews diffs and requires per-file approval, but approved writes are still direct and there is still no sandbox. Users must build in a clean VCS tree and inspect the result afterward.

**Status**: superseded in part by ADR-0004; direct writes remain

**Consequences**: files can be clobbered with no rollback; prompt injection can write code after approval; the sandbox claim is removed, and isolation remains deferred.

**Considered options**: dry-run diff with confirmation; temporary-directory sandbox; automatic branch or stash before writing.
