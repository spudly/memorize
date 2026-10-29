// Syncs packages/app/app.json's expo.version to the fixed-group version
// in packages/app/package.json.
//
// Runs as part of the changesets version step (see the `version-script`
// input in .github/workflows/release.yml, via scripts/changesetVersion.mjs),
// so the Pending Release PR itself carries the stamped app.json and merging
// it puts the stamp on main through the pull request. The publish step
// (scripts/changesetRelease.mjs) must never push a stamp commit to main
// directly: the repository ruleset rejects direct pushes to main
// (GH013, issue #65).
//
// Idempotent: a no-op when app.json already reports the group version.
import { readFileSync, writeFileSync } from "node:fs";

const appJsonPath = "packages/app/app.json";
const version = JSON.parse(readFileSync("packages/app/package.json", "utf8")).version;

const appJsonText = readFileSync(appJsonPath, "utf8");
// Only expo.version is the stamp target — other "version" keys elsewhere
// in the file (e.g. a future expo.extra.version) must not be touched.
// Parse to read the current value; for the write, replace only the
// "version" key that is a direct child of "expo": app.json is
// prettier-formatted (enforced by lint-staged), so direct expo keys sit
// at exactly four spaces of indentation while nested keys (extra.*) sit
// deeper. The file's formatting is otherwise preserved byte-for-byte.
const appJson = JSON.parse(appJsonText);
if (typeof appJson.expo?.version !== "string") {
  throw new Error(`expected a string expo.version in ${appJsonPath}`);
}
if (appJson.expo.version === version) {
  console.log(`expo.version already ${version}; no change.`);
} else {
  const directVersionKeys = appJsonText.match(/^ {4}"version": "[^"]*",?$/gm) ?? [];
  if (directVersionKeys.length !== 1) {
    throw new Error(
      `expected exactly one direct expo "version" key in ${appJsonPath}, found ${directVersionKeys.length}`,
    );
  }
  writeFileSync(
    appJsonPath,
    appJsonText.replace(
      /^ {4}"version": "[^"]*",?$/m,
      (match) => `    "version": "${version}"${match.endsWith(",") ? "," : ""}`,
    ),
  );
  console.log(`Stamped expo.version ${version} into ${appJsonPath}.`);
}
