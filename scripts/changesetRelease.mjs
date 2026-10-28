// Publish step for the pending-release flow (issue #48).
//
// Runs via changesets/action on pushes to main that carry no pending
// changesets — i.e. right after a Pending Release PR merges. Duties:
//   1. Stamp the fixed-group version into packages/app/app.json
//      (expo.version), committed if it changed.
//   2. Tag that commit v<version> (skipped if the tag already exists).
//   3. Push the exact tagged commit to the `production` branch — the
//      push Vercel deploys, since the project's Production Branch is
//      `production`.
//   4. Create the GitHub Release for the tag (skipped if it exists).
//
// Idempotent: a re-run after a partial failure converges without
// duplicating commits, tags, or releases.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function capture(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

run("git", ["config", "user.name", "github-actions[bot]"]);
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);

const version = JSON.parse(readFileSync("packages/app/package.json", "utf8")).version;
const tag = `v${version}`;

// 1. Stamp expo.version so the shipped app reports the group version.
const appJsonPath = "packages/app/app.json";
const appJson = readFileSync(appJsonPath, "utf8");
const versionKeys = appJson.match(/"version": "[^"]*"/g) ?? [];
if (versionKeys.length !== 1) {
  throw new Error(
    `expected exactly one "version" key in ${appJsonPath}, found ${versionKeys.length}`,
  );
}
const stamped = appJson.replace(/"version": "[^"]*"/, `"version": "${version}"`);
if (stamped !== appJson) {
  writeFileSync(appJsonPath, stamped);
  run("git", ["add", appJsonPath]);
  run("git", ["commit", "-m", `chore(release): stamp expo version ${version}`]);
  run("git", ["push", "origin", "HEAD:main"]);
}

// 2. Tag the release commit (this HEAD, after any stamp commit).
if (!capture("git", ["tag", "-l", tag])) {
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
}
run("git", ["push", "origin", tag]);

// 3. Push the exact tagged commit to production (fast-forward by
// design: only this workflow ever writes that branch).
run("git", ["push", "origin", "HEAD:production"]);

// 4. GitHub Release for the tag.
let releaseExists = true;
try {
  capture("gh", ["release", "view", tag]);
} catch {
  releaseExists = false;
}
if (!releaseExists) {
  run("gh", ["release", "create", tag, "--title", tag, "--generate-notes"]);
}

console.log(`Released ${tag}: expo.version stamped, tag pushed, production updated.`);
