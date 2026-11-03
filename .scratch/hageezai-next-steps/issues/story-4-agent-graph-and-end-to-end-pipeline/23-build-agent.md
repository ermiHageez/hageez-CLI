# 23 — Build agent

**What to build:** The existing builder plus approval gate becomes the `build` Agent, consuming the plan and producing project-file changes and a `changes` artifact. It is the only Agent allowed to write project files, and every write still passes through the diff approval gate.

**Blocked by:** 22 — PM agent; 06 — Diff approval, backups, and dry-run.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 15c.

- [x] The `build` Agent wraps the existing builder and approval gate rather than bypassing either.
- [x] It consumes the plan artifact and writes project changes plus a `changes` artifact.
- [x] It is the only Agent permitted to write project files.
- [x] `--yes`, `--dry-run`, non-TTY refusal, backups, and path containment still apply.
- [x] The Agent has a system prompt, declared inputs and outputs, and one test.
- [x] Tests cover approved changes, rejected changes, and the single-writer boundary.
