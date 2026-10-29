// Version step for the Pending Release PR (see the `version-script` input
// in .github/workflows/release.yml): bump the fixed-group versions with
// changesets, then stamp expo.version to match (scripts/syncExpoVersion.mjs).
//
// This wrapper exists because changesets/action executes the version
// script via @actions/exec without a shell, so a compound command like
// `npx changeset version && node scripts/syncExpoVersion.mjs` would pass
// `&& …` to npx as arguments and the stamp would never run.
import { execFileSync } from "node:child_process";

execFileSync("npx", ["changeset", "version"], { stdio: "inherit" });
execFileSync("node", ["scripts/syncExpoVersion.mjs"], { stdio: "inherit" });
