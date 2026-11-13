/**
 * Shared staged-change plumbing for the pre-commit steps
 * (scripts/precommitTypecheck.mjs and scripts/precommitAffectedTests.mjs,
 * run in order by .husky/pre-commit after lint-staged). Split out of the
 * former single scripts/precommit.mjs for the shared tooling standard
 * (memorize#118): the hook now exposes the standard steps — a standalone
 * typecheck step plus the `precommit:affected-tests` script — while the
 * staged-file → package mapping, dependency builds, and dirty-tree
 * refusal below keep exactly the semantics the combined script had.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { affectedWorkspaces } from "@spudly/tooling";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

// Dependency order: workspace consumers come after the packages they
// import, so a dependency's typecheck lands before its consumers'.
// `tsconfig` is the config the package's own `typecheck` script uses
// (core typechecks through its check config, which includes tests).
export const PACKAGES = [
  { dir: "types", tsconfig: "tsconfig.json" },
  { dir: "core", tsconfig: "tsconfig.check.json" },
  { dir: "web", tsconfig: "tsconfig.json" },
  { dir: "app", tsconfig: "tsconfig.json" },
];

// Workspace packages whose built output the other packages resolve at
// typecheck and test time, in build order.
const BUILDABLE_DEPS = ["types", "core"];

export function run(command, args) {
  console.log(`\n[pre-commit] ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: repoRoot, stdio: "inherit" });
}

export function readManifest(dir) {
  const path = join(repoRoot, "packages", dir, "package.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function stagedTypeScriptFiles() {
  // Deletions count: a commit that only deletes a TypeScript file still
  // has to typecheck and test the package the file belonged to.
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split("\n").filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

// The staged-file → package mapping comes from @spudly/tooling's
// affectedWorkspaces primitive (memorize#118); the result is re-ordered
// into PACKAGES dependency order, which the primitive deliberately does
// not know about (per-repo package graphs stay in the consumer).
export function touchedPackageDirs(staged) {
  const touched = new Set(
    affectedWorkspaces(staged).map((workspace) => workspace.replace(/^packages\//, "")),
  );
  return PACKAGES.map(({ dir }) => dir).filter((dir) => touched.has(dir));
}

function unstagedFiles() {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

function untrackedFiles(dir) {
  const out = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", `packages/${dir}`],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return out.split("\n").filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

// A consumer's typecheck/tests resolve workspace dependencies through
// their dist output. An existing dist is never trusted as current — a
// branch switch or an earlier commit can leave it describing other
// source — so every dependency a gated commit needs (a consumer is
// being checked, or the dependency itself is touched) is rebuilt from
// the current tree first. Builds are plain `tsc -p`.
export function ensureDependencyBuilds(checkDirs, touchedDirs) {
  const needsTypes = checkDirs.some((dir) => dir !== "types");
  const needsCore = checkDirs.some((dir) => dir === "web" || dir === "app");
  const unstaged = unstagedFiles();
  for (const dir of BUILDABLE_DEPS) {
    const needed = dir === "types" ? needsTypes : needsCore;
    const sourceChanged = touchedDirs.includes(dir);
    if (!needed && !sourceChanged) continue;
    // The build reads the working tree, but the commit takes the index,
    // and the dist it writes outlives this commit. Any dependency file
    // whose working-tree content differs from the index (unstaged edits
    // or deletions, partially staged files, untracked sources) would
    // bake uncommitted content into that dist — refuse until the
    // package's tree matches what is being committed.
    const dirty = [
      ...unstaged.filter((file) => file.startsWith(`packages/${dir}/`)),
      ...untrackedFiles(dir),
    ];
    if (dirty.length > 0) {
      console.error(
        `\n[pre-commit] packages/${dir} has uncommitted changes (${dirty.join(", ")}); ` +
          "stage or stash them so the dependency build matches the commit.",
      );
      throw new Error("uncommitted changes in workspace dependency");
    }
    run("npm", ["run", "build", `--workspace=${readManifest(dir).name}`]);
  }
}
