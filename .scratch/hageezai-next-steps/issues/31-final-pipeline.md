# 31 — Final pipeline

**What to build:** `hageez build "task"` runs the complete Agent graph end to end, writes every artifact under the Run, applies approved Build changes, runs review and QA in parallel, and finishes with a retrospective that leaves a Decision for the next Run.

**Blocked by:** 28 — Project-context agent; 30 — Retrospective agent.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 17.

- [ ] The pipeline runs analyst, product brief, the PM/UX/architect branch, project context, Build, review and QA, and retrospective in the specified order.
- [ ] Independent branches run in parallel and dependency ordering is enforced.
- [ ] All Agent artifacts and the Run manifest are written under the project's `ai-learning` Run directory.
- [ ] Project changes still pass through the diff approval gate and the single-writer rule.
- [ ] The retrospective adds at least one Decision that the next Run recalls.
- [ ] Existing `hageez build` behaviour is preserved for the user-facing Task flow.
- [ ] An end-to-end test proves the graph, artifacts, approval boundary, and next-Run recall.
