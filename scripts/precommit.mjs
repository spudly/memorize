/**
 * Pre-commit gate beyond lint-staged (.husky/pre-commit runs this after
 * lint-staged): for every package touched by staged TypeScript changes,
 * run that package's typecheck with an incremental build-info cache and
 * that package's unit tests. Packages the commit does not touch are
 * skipped, so the hook stays fast; CI remains the full-suite authority.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");

// Dependency order: workspace consumers come after the packages they
// import, so a dependency's typecheck lands before its consumers'.
// `tsconfig` is the config the package's own `typecheck` script uses
// (core typechecks through its check config, which includes tests).
const PACKAGES = [
  { dir: "types", tsconfig: "tsconfig.json" },
  { dir: "core", tsconfig: "tsconfig.check.json" },
  { dir: "web", tsconfig: "tsconfig.json" },
  { dir: "app", tsconfig: "tsconfig.json" },
];

// Workspace packages whose built output the other packages resolve at
// typecheck and test time, in build order.
const BUILDABLE_DEPS = ["types", "core"];

function run(command, args) {
  console.log(`\n[pre-commit] ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: repoRoot, stdio: "inherit" });
}

function readManifest(dir) {
  const path = join(repoRoot, "packages", dir, "package.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function stagedTypeScriptFiles() {
  const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split("\n").filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

function unstagedFiles() {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

// A consumer's typecheck/tests resolve workspace dependencies through
// their dist output; build any missing one first (a fresh checkout has
// none). A dependency whose own source is staged must also rebuild even
// when dist exists, or consumers resolve the previous declarations.
// Builds are plain `tsc -p`, so this is a no-op in a warm tree whose
// dependencies are untouched and already built.
function ensureDependencyBuilds(typecheckDirs, touchedDirs, staged) {
  const needsTypes = typecheckDirs.some((dir) => dir !== "types");
  const needsCore = typecheckDirs.some((dir) => dir === "web" || dir === "app");
  const unstaged = unstagedFiles();
  for (const dir of BUILDABLE_DEPS) {
    const needed = dir === "types" ? needsTypes : needsCore;
    if (!needed) continue;
    const sourceChanged = touchedDirs.includes(dir);
    if (!sourceChanged && existsSync(join(repoRoot, "packages", dir, "dist", "index.d.ts")))
      continue;
    // The build reads the working tree, but the commit takes the index.
    // A partially staged dependency file would build declarations from
    // content that is not being committed, and that dist would then be
    // reused by later commits — refuse until the file is staged in full.
    if (sourceChanged) {
      const partial = staged.filter(
        (file) => file.startsWith(`packages/${dir}/`) && unstaged.includes(file),
      );
      if (partial.length > 0) {
        console.error(
          `\n[pre-commit] packages/${dir} has partially staged changes (${partial.join(", ")}); ` +
            "stage each file in full so the dependency build matches the commit.",
        );
        throw new Error("partially staged workspace dependency");
      }
    }
    run("npm", ["run", "build", `--workspace=${readManifest(dir).name}`]);
  }
}

function main() {
  const staged = stagedTypeScriptFiles();
  if (staged.length === 0) return;

  const touchedDirs = PACKAGES.filter(({ dir }) =>
    staged.some((file) => file.startsWith(`packages/${dir}/`)),
  ).map(({ dir }) => dir);
  // A staged TypeScript file outside every package (a root config such
  // as eslint.config.ts) can affect any package: typecheck them all,
  // but still only run the tests of packages the commit touches.
  const hasRootTypeScript = staged.some((file) => !file.startsWith("packages/"));
  const typecheckDirs = hasRootTypeScript ? PACKAGES.map(({ dir }) => dir) : touchedDirs;

  ensureDependencyBuilds(typecheckDirs, touchedDirs, staged);

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

  for (const dir of touchedDirs) {
    const manifest = readManifest(dir);
    if (!manifest.scripts?.test) continue;
    run("npm", ["run", "test", `--workspace=${manifest.name}`]);
  }
}

try {
  main();
} catch {
  console.error("\n[pre-commit] typecheck or affected tests failed; commit aborted.");
  process.exit(1);
}
