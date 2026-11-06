import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import semver from "semver";

/**
 * Lockfile-sync guard (#102, sibling of eciperay #445).
 *
 * A Dependabot group bump once raised dependency specs in eciperay's
 * workspace manifests while its lockfile update left nested resolved
 * versions stale; nothing in CI checked that locked versions satisfy
 * manifest specs, so the desync survived ten days of green CI and then
 * broke a deploy. This test parses package-lock.json and fails when any
 * direct dependency's locked version does not satisfy its workspace
 * manifest spec, so a desynced Dependabot PR fails on its own diff.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Specs npm resolves from somewhere other than the registry. */
function isNonRegistrySpec(spec) {
  return (
    spec.includes(":") || // workspace:, file:, link:, git+https:, …
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec === "*"
  );
}

/**
 * The registry range behind an `npm:` alias spec, e.g.
 * `npm:real-foo@^2.0.0` → `^2.0.0` and `npm:@scope/pkg@^1.0.0` → `^1.0.0`.
 * npm installs the aliased package under the manifest's dependency name,
 * so the locked entry under that name must satisfy this range. Returns
 * null when the alias names no range (npm resolves the latest version).
 */
function aliasRange(spec) {
  const body = spec.slice("npm:".length);
  const at = body.lastIndexOf("@");
  if (at <= 0) return null;
  const range = body.slice(at + 1);
  return semver.validRange(range) ? range : null;
}

/**
 * The locked version of `name` as seen from the workspace at
 * `workspacePath` ("" for the root): a nested entry under the workspace
 * wins, then the hoisted root entry. Link entries (workspace packages)
 * resolve to their target workspace's version.
 */
export function lockedVersion(lockPackages, workspacePath, name) {
  const candidates = workspacePath
    ? [`${workspacePath}/node_modules/${name}`, `node_modules/${name}`]
    : [`node_modules/${name}`];
  for (const key of candidates) {
    const entry = lockPackages[key];
    if (!entry) continue;
    if (entry.link) {
      const target = lockPackages[entry.resolved];
      if (target?.version) return target.version;
      continue;
    }
    if (entry.version) return entry.version;
  }
  return null;
}

/**
 * Pure checker: `manifests` is a list of { path, manifest } where path is
 * the workspace's directory relative to the repo root ("" for the root
 * manifest). Returns one string per direct dependency whose locked
 * version is missing or does not satisfy its manifest spec.
 */
export function findLockfileMismatches(manifests, lockPackages) {
  const failures = [];
  for (const { path, manifest } of manifests) {
    const where = path || ".";
    for (const section of ["dependencies", "devDependencies"]) {
      for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
        // An `npm:` alias resolves from the registry under the alias
        // name, so check its target range instead of skipping it.
        const isAlias = spec.startsWith("npm:");
        const range = isAlias ? aliasRange(spec) : spec;
        if (range === null || (!isAlias && isNonRegistrySpec(spec)) || !semver.validRange(range))
          continue;
        const version = lockedVersion(lockPackages, path, name);
        if (version === null) {
          failures.push(`${where}: ${name}@${spec} has no locked entry in package-lock.json`);
        } else if (!semver.satisfies(version, range)) {
          failures.push(
            `${where}: ${name}@${spec} is locked at ${version}, which does not satisfy the spec`,
          );
        }
      }
    }
  }
  return failures;
}

function loadRepoManifests() {
  const rootManifest = readJson(join(repoRoot, "package.json"));
  const manifests = [{ path: "", manifest: rootManifest }];
  for (const workspacePath of rootManifest.workspaces ?? []) {
    manifests.push({
      path: workspacePath,
      manifest: readJson(join(repoRoot, workspacePath, "package.json")),
    });
  }
  return manifests;
}

test("package-lock.json locked versions satisfy every workspace manifest spec", () => {
  const lock = readJson(join(repoRoot, "package-lock.json"));
  const failures = findLockfileMismatches(loadRepoManifests(), lock.packages);
  assert.deepEqual(failures, []);
});

test("checker flags a nested entry below its spec floor (eciperay pre-fix shape)", () => {
  const manifests = [
    {
      path: "packages/web",
      manifest: { dependencies: { posthog: "^2.0.0" } },
    },
  ];
  const lockPackages = {
    "node_modules/posthog": { version: "2.1.0" },
    // The desync shape: the nested copy actually resolved for the
    // workspace stayed below the raised spec's floor.
    "packages/web/node_modules/posthog": { version: "1.9.0" },
  };
  const failures = findLockfileMismatches(manifests, lockPackages);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /posthog@\^2\.0\.0 is locked at 1\.9\.0/);
});

test("checker accepts hoisted entries, workspace links, and skips non-registry specs", () => {
  const manifests = [
    {
      path: "packages/app",
      manifest: {
        dependencies: {
          react: "^19.0.0",
          "@memorize/core": "1.1.4",
          local: "workspace:*",
        },
      },
    },
  ];
  const lockPackages = {
    "node_modules/react": { version: "19.3.0" },
    "node_modules/@memorize/core": { link: true, resolved: "packages/core" },
    "packages/core": { version: "1.1.4" },
  };
  assert.deepEqual(findLockfileMismatches(manifests, lockPackages), []);
});

test("checker validates npm: alias specs against the aliased range", () => {
  const manifests = [
    {
      path: "",
      manifest: {
        dependencies: {
          foo: "npm:real-foo@^2.0.0",
          bar: "npm:@scope/real-bar@^1.0.0",
          baz: "npm:real-baz",
        },
      },
    },
  ];
  const stale = {
    "node_modules/foo": { version: "1.9.0" },
    "node_modules/bar": { version: "1.4.0" },
  };
  const failures = findLockfileMismatches(manifests, stale);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /foo@npm:real-foo@\^2\.0\.0 is locked at 1\.9\.0/);

  const current = {
    "node_modules/foo": { version: "2.3.0" },
    "node_modules/bar": { version: "1.4.0" },
  };
  assert.deepEqual(findLockfileMismatches(manifests, current), []);
});

test("checker flags a dependency with no locked entry", () => {
  const manifests = [{ path: "", manifest: { devDependencies: { turbo: "^2.0.0" } } }];
  const failures = findLockfileMismatches(manifests, {});
  assert.equal(failures.length, 1);
  assert.match(failures[0], /turbo@\^2\.0\.0 has no locked entry/);
});
