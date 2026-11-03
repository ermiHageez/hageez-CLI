# 20 — Skills loader

**What to build:** A user can define project and global Skills as markdown with metadata, then list, add, enable, and disable them. Matching Skills are loaded into the applicable Agent's prompt instead of being ignored.

**Blocked by:** 15 — Agent runtime; 19 — Memory recall.

**Status:** resolved

**Resolution:** Implemented and verified with `npm run lint`, `npm test` (109 passing), and `npm run build`.

**Covers:** NEXT_STEPS Step 14.

- [x] A Skill is a markdown file with frontmatter for name, description, and applicable Agents, discoverable from both the project and the user's global area.
- [x] Matching Skills are passed into the system prompt for the Agent they apply to.
- [x] Disabled Skills are not loaded.
- [x] `hageez skills list`, `add`, `enable`, and `disable` work against the correct scope.
- [x] Invalid or non-matching Skills do not break a run.
- [x] Tests prove a Skill's content appears in the prompt of an applicable Agent and not in an unrelated Agent.
