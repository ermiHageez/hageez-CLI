# CommonJS output with ESM-only dependencies requires Node 22.12+

The CLI compiles to CommonJS (`tsconfig.json`), while `chalk@5` and `inquirer@10` are ESM-only, so loading them depends on Node's `require(esm)` support. The package now declares and checks `node >=22.12.0`, where that interop is stable. CommonJS remains because the bin, every module, and the global install assume it.

**Status**: accepted (ticket 14 raised `engines`, the lockfile, doctor, and this ADR to Node >=22.12.0)

**Consequences**: Node 18 and early Node 22 releases are unsupported and `doctor` fails below 22.12; CI covers the raised floor; an ESM migration would remove the constraint.

**Considered options**: raise `engines` and document the requirement; pin ESM-only packages to CommonJS-compatible majors; migrate the package to ESM.
