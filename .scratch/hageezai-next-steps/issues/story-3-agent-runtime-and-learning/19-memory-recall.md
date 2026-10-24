# 19 — Memory recall

**What to build:** A user can list, add, and remove project Decisions, and relevant Decisions are injected into every Agent's system prompt through one project-context builder. A debug view proves recall without calling a model and shows only decision metadata.

**Blocked by:** 15 — Agent runtime.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 13.

- [ ] `hageez memory list`, `add`, and `remove` operate on the current project's Decisions.
- [ ] Recall returns all Decisions for the project and can filter by keyword.
- [ ] Recalled Decisions are injected into every Agent's system prompt through a single project-context builder.
- [ ] The debug view shows the recall result and decision metadata without calling a model.
- [ ] The debug view never prints file contents, and no key material is exposed.
- [ ] Tests prove a newly added Decision appears in the next Agent prompt and that keyword filtering is applied.
