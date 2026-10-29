// Syncs packages/app/app.json's expo.version to the fixed-group version
// in packages/app/package.json.
//
// Runs as part of the changesets version step (see the `version` input in
// .github/workflows/release.yml), so the Pending Release PR itself carries
// the stamped app.json and merging it puts the stamp on main through the
// pull request. The publish step (scripts/changesetRelease.mjs) must never
// push a stamp commit to main directly: the repository ruleset rejects
// direct pushes to main (GH013, issue #65).
//
// Idempotent: a no-op when app.json already reports the group version.
import { readFileSync, writeFileSync } from "node:fs";

const appJsonPath = "packages/app/app.json";
const version = JSON.parse(readFileSync("packages/app/package.json", "utf8")).version;

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
  console.log(`Stamped expo.version ${version} into ${appJsonPath}.`);
} else {
  console.log(`expo.version already ${version}; no change.`);
}
