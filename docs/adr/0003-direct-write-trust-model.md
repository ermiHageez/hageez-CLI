# Builder writes files directly, without a sandbox or diff approval

The Build pipeline writes generated files to disk immediately (`writeFiles` in `src/builder/index.ts`), with no dry run, diff confirmation, or isolated workspace, although the startup and dashboard footers claim "Sandbox: Enabled". Direct write is the v1 trust model; users must build in a clean VCS tree and inspect the result afterward. Introducing approval or a real sandbox would supersede this decision.

**Status**: accepted (v1)

**Consequences**: files can be clobbered with no rollback; prompt injection can write code; the sandbox claim must be removed or backed by real isolation.

**Considered options**: dry-run diff with confirmation; temporary-directory sandbox; automatic branch or stash before writing.
