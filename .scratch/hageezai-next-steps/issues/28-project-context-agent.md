# 28 — Project-context agent

**What to build:** A `project-context` gatekeeper Agent merges the PM plan, architecture design, optional UX design, recalled Decisions, and matching Skills into one context artifact for the Build. Conflicts between upstream artifacts are resolved explicitly rather than silently dropped.

**Blocked by:** 22 — PM agent; 26 — Architect agent; 27 — UX designer agent; 19 — Memory recall; 20 — Skills loader.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 16d.

- [ ] The Agent consumes the PM, architecture, optional UX, Memory, and Skills inputs.
- [ ] It writes one context artifact that the Build can consume.
- [ ] Conflicts are recorded and resolved explicitly, with the chosen resolution visible.
- [ ] Absent optional inputs are handled without failing the Run.
- [ ] It writes artifacts only and performs no project file writes.
- [ ] Tests cover merging, conflict resolution, optional UX absence, Decision injection, and Skill injection.
