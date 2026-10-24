# 20 — Skills loader

**What to build:** A user can define project and global Skills as markdown with metadata, then list, add, enable, and disable them. Matching Skills are loaded into the applicable Agent's prompt instead of being ignored.

**Blocked by:** 15 — Agent runtime; 19 — Memory recall.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 14.

- [ ] A Skill is a markdown file with frontmatter for name, description, and applicable Agents, discoverable from both the project and the user's global area.
- [ ] Matching Skills are passed into the system prompt for the Agent they apply to.
- [ ] Disabled Skills are not loaded.
- [ ] `hageez skills list`, `add`, `enable`, and `disable` work against the correct scope.
- [ ] Invalid or non-matching Skills do not break a run.
- [ ] Tests prove a Skill's content appears in the prompt of an applicable Agent and not in an unrelated Agent.
