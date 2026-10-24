# Global configuration, project-local learning artifacts

Provider credentials and settings live in `~/.hageezai/config.json`, while per-project artifacts (Session Logs, Memory, datasets) live in the target project's gitignored `ai-learning/` directory. This gives one key across all projects while keeping project history with the codebase, at the cost of duplicated logs per project and a machine-wide configuration shared by unrelated work.

**Status**: accepted

**Consequences**: deleting a project's ai-learning directory loses its history; configuration and artifacts are backed up separately; the API key sits in the home directory rather than the project.

**Considered options**: all state project-local under `.hageez/`; all state under the home directory keyed by project path.
