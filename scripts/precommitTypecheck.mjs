/**
 * Pre-commit typecheck step (.husky/pre-commit runs this after
 * lint-staged, before `precommit:affected-tests`): for every package
 * touched by staged TypeScript changes, run that package's typecheck
 * with an incremental build-info cache. Packages the commit does not
 * touch are skipped, so the hook stays fast; CI remains the full-suite
 * authority. Split out of the former scripts/precommit.mjs for the
 * shared tooling standard (memorize#118) with its semantics unchanged.
 */
import { join } from "node:path";

import {
  PACKAGES,
  ensureDependencyBuilds,
  run,
  stagedTypeScriptFiles,
  touchedPackageDirs,
  tscBin,
} from "./precommitShared.mjs";

function main() {
  const staged = stagedTypeScriptFiles();
  if (staged.length === 0) return;

  const touchedDirs = touchedPackageDirs(staged);
  // A staged TypeScript file outside every package (a root config such
  // as eslint.config.ts) can affect any package: typecheck them all
  // (the affected-tests step still only tests packages the commit
  // touches).
  const hasRootTypeScript = staged.some((file) => !file.startsWith("packages/"));
  const typecheckDirs = hasRootTypeScript ? PACKAGES.map(({ dir }) => dir) : touchedDirs;

  ensureDependencyBuilds(typecheckDirs, touchedDirs);

  for (const { dir, tsconfig } of PACKAGES) {
    if (!typecheckDirs.includes(dir)) continue;
    run(tscBin, [
      "--noEmit",
      "-p",
      join("packages", dir, tsconfig),
      "--incremental",
      "--tsBuildInfoFile",
      join("packages", dir, ".tsbuildinfo"),
    ]);
  }
}

try {
  main();
} catch {
  console.error("\n[pre-commit] typecheck failed; commit aborted.");
  process.exit(1);
}
