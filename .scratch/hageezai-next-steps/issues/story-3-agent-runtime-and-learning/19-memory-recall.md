# 19 — Memory recall

**What to build:** A user can list, add, and remove project Decisions, and relevant Decisions are injected into every Agent's system prompt through one project-context builder. A debug view proves recall without calling a model and shows only decision metadata.

**Blocked by:** 15 — Agent runtime.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 13.

- [x] `hageez memory list`, `add`, and `remove` operate on the current project's Decisions.
- [x] Recall returns all Decisions for the project and can filter by keyword.
- [x] Recalled Decisions are injected into every Agent's system prompt through a single project-context builder.
- [x] The debug view shows the recall result and decision metadata without calling a model.
- [x] The debug view never prints file contents, and no key material is exposed.
- [x] Tests prove a newly added Decision appears in the next Agent prompt and that keyword filtering is applied.
