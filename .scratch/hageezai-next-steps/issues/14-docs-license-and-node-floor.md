# 14 — Docs, license, and Node floor

**What to build:** The repository documentation agrees with the code after the safety and correctness work, the package declares and checks the supported Node floor, and the project has a README and an MIT license. This ticket is also the Phase 0/1 verification gate.

**Blocked by:** 01 — Test harness and CI; 04 — Safe opencode delegation; 07 — Truthful Build pipeline and failed Session Logs; 08 — Truthful startup and single version source; 09 — Provider hardening; 10 — Connection schema expansion; 11 — Cloud connections and model catalog; 12 — Ollama connection and model kinds; 13 — Connection contract.

**Status:** ready-for-agent

**Covers:** NEXT_STEPS Step 9.

- [ ] Every correction listed in the audit report's documentation section is applied.
- [ ] The package, lockfile, doctor, and CommonJS/runtime ADR all declare Node `>=22.12.0`.
- [ ] The direct-write ADR records that the sandbox claim was removed while direct writes remain the v1 trust model.
- [ ] `README.md` covers install, run, as-built versus planned behaviour, the security note, and local development commands.
- [ ] `LICENSE` is MIT with the package author and year 2026.
- [ ] The backlog marks completed Phase 0/1 work accurately, including the connection and Ollama work; it does not claim the Git baseline unless that commit exists.
- [ ] No document retains a claim the audit disproved; lint, build, and the full test suite pass before this gate closes.
