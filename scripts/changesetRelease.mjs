// Publish step for the pending-release flow (issue #48).
//
// Runs via changesets/action on pushes to main that carry no pending
// changesets — i.e. right after a Pending Release PR merges. Duties:
//   1. Verify packages/app/app.json already reports the group version.
//      The stamp is part of the Pending Release PR itself (the workflow's
//      version step runs scripts/syncExpoVersion.mjs), because this step
//      must never push to main: the repository ruleset rejects direct
//      pushes to main (GH013, issue #65 — the v1.1.0 publish failed on
//      exactly that push, so nothing shipped).
//   2. Tag HEAD v<version> (skipped if the tag already exists).
//   3. Push the exact tagged commit to the `production` branch — the
//      push Vercel deploys, since the project's Production Branch is
//      `production`.
//   4. Create the GitHub Release for the tag (skipped if it exists).
//
// Idempotent: a re-run after a partial failure converges without
// duplicating tags or releases.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function capture(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

const version = JSON.parse(readFileSync("packages/app/package.json", "utf8")).version;
const tag = `v${version}`;

// 1. The shipped app must report the group version. If app.json disagrees,
// the Pending Release PR was created without the version-step sync (e.g.
// it predates scripts/syncExpoVersion.mjs): fail loudly so the release is
// re-cut through the sync instead of shipping a stale stamp.
const appJson = JSON.parse(readFileSync("packages/app/app.json", "utf8"));
if (appJson.expo?.version !== version) {
  throw new Error(
    `packages/app/app.json expo.version is ${appJson.expo?.version}, expected ${version}. ` +
      `Run \`node scripts/syncExpoVersion.mjs\` and land the stamp through a pull request ` +
      `(the Pending Release PR carries it automatically via the release workflow's version step).`,
  );
}

run("git", ["config", "user.name", "github-actions[bot]"]);
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);

// 2. Tag the release commit (HEAD — the merged Pending Release PR commit).
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

console.log(`Released ${tag}: tag pushed, production updated.`);
