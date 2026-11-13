/**
 * Affected-tests step of the pre-commit hook, exposed as the standard
 * `precommit:affected-tests` script (.husky/pre-commit runs it after
 * the typecheck step): run the unit tests of every package touched by
 * staged TypeScript changes. Packages the commit does not touch are
 * skipped, so the hook stays fast; CI remains the full-suite authority.
 * Split out of the former scripts/precommit.mjs for the shared tooling
 * standard (memorize#118) with its semantics unchanged: the package
 * mapping comes from @spudly/tooling's affectedWorkspaces primitive
 * (via precommitShared), and a package's tests resolve workspace
 * dependencies through their dist output, so the dependency builds the
 * tests need are ensured first (the typecheck step may already have
 * built them in this hook run; the rebuild is a plain `tsc -p`).
 */
import {
  ensureDependencyBuilds,
  readManifest,
  run,
  stagedTypeScriptFiles,
  touchedPackageDirs,
} from "./precommitShared.mjs";

function main() {
  const staged = stagedTypeScriptFiles();
  if (staged.length === 0) return;

  const touchedDirs = touchedPackageDirs(staged);
  if (touchedDirs.length === 0) return;

  ensureDependencyBuilds(touchedDirs, touchedDirs);

  for (const dir of touchedDirs) {
    const manifest = readManifest(dir);
    if (!manifest.scripts?.test) continue;
    run("npm", ["run", "test", `--workspace=${manifest.name}`]);
  }
}

try {
  main();
} catch {
  console.error("\n[pre-commit] affected tests failed; commit aborted.");
  process.exit(1);
}
