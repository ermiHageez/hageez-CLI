# CommonJS output with ESM-only dependencies on a Node 18 floor

The CLI compiles to CommonJS (`tsconfig.json`), while `chalk@5` and `inquirer@10` are ESM-only, so loading them depends on Node's `require(esm)` support. `package.json` still declares `node >=18`, where that interop is unavailable, so the CLI can fail at startup on a version it advertises. CommonJS remains because the bin, every module, and the global install assume it, but the declared floor must be raised to a version with stable `require(esm)` (20.19+/22.12+), or the dependencies pinned or migrated.

**Status**: accepted

**Consequences**: Node 18 users are unsupported despite `engines`; CI must cover the raised floor; an ESM migration would remove the constraint.

**Considered options**: raise `engines` and document the requirement; pin ESM-only packages to CommonJS-compatible majors; migrate the package to ESM.
