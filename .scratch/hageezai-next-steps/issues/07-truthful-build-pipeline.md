# 07 — Truthful Build pipeline and failed Session Logs

**What to build:** A Build reports only the six steps it actually runs, with real elapsed times, and a failed or partially applied Build is recorded as such instead of being reported as success. Fake flags, the fake committing step, and artificial delays are gone.

**Blocked by:** 06 — Diff approval, backups, and dry-run.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 6, pipeline and Session Log portion.

- [ ] The visible pipeline is exactly scan/context, understand, plan, generate, apply, and review; no committing step remains.
- [ ] Build no longer accepts the fake TDD/PRD flags; Plan still accepts its PRD flag.
- [ ] No artificial delay remains, and per-step durations are measured from real work.
- [ ] A thrown Build records a failed Session Log with actual step statuses, `outcome: failed`, and the error.
- [ ] A Session Log write failure does not hide the original Build error.
- [ ] A write failure records `partial` and renders a warning summary, not a success.
