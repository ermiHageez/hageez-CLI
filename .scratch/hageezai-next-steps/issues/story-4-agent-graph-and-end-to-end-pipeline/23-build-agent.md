# 23 — Build agent

**What to build:** The existing builder plus approval gate becomes the `build` Agent, consuming the plan and producing project-file changes and a `changes` artifact. It is the only Agent allowed to write project files, and every write still passes through the diff approval gate.

**Blocked by:** 22 — PM agent; 06 — Diff approval, backups, and dry-run.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 15c.

- [ ] The `build` Agent wraps the existing builder and approval gate rather than bypassing either.
- [ ] It consumes the plan artifact and writes project changes plus a `changes` artifact.
- [ ] It is the only Agent permitted to write project files.
- [ ] `--yes`, `--dry-run`, non-TTY refusal, backups, and path containment still apply.
- [ ] The Agent has a system prompt, declared inputs and outputs, and one test.
- [ ] Tests cover approved changes, rejected changes, and the single-writer boundary.
