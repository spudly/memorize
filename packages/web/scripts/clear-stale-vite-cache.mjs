#!/usr/bin/env node
/**
 * Stale Vite dep-cache guard — runs as `predev` for @memorize/web.
 *
 * Vite pre-bundles workspace dependencies (@memorize/core, @memorize/types)
 * into node_modules/.vite, but the cache key is derived from package
 * metadata and the lockfile — NOT from the contents of a linked package's
 * dist. Rebuilding core (or switching branches, which changes what the
 * dist contains) therefore does not invalidate the cache: the dev server
 * keeps serving the old bundle, and app changes in core silently never
 * reach the browser. This bit us for real on 2026-10-16 (the web client
 * kept running pre-fix search code with an up-to-date checkout).
 *
 * The guard fingerprints both dist trees (relative paths and file
 * contents). When the
 * fingerprint differs from the one recorded for the current cache, the
 * cache is wiped so the next optimization is built from the dist as it
 * exists now. When it matches, this is a no-op — ordinary dev restarts
 * keep the fast path. It never fails the dev start: any error is logged
 * and swallowed.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(webRoot, "..", "..");

const DIST_DIRS = [
  join(repoRoot, "packages", "core", "dist"),
  join(repoRoot, "packages", "types", "dist"),
];
const CACHE_DIRS = [
  join(repoRoot, "node_modules", ".vite"),
  join(webRoot, "node_modules", ".vite"),
];
const STAMP_PATH = join(repoRoot, "node_modules", ".memorize-vite-deps-stamp.json");

function listFiles(dir) {
  if (!existsSync(dir)) {
    return null;
  }
  const files = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files.sort();
}

function currentFingerprint() {
  // Hash file CONTENTS, not metadata: a timestamp-preserving restore
  // (Turbo cache, cp -p, tar) can replace dist bytes while keeping size
  // and mtime identical, and a metadata-only fingerprint would call
  // that "unchanged" and keep the stale bundle.
  const hash = createHash("sha256");
  for (const dir of DIST_DIRS) {
    const files = listFiles(dir);
    if (files === null) {
      hash.update(`missing:${dir}\n`);
      continue;
    }
    for (const full of files) {
      hash.update(relative(dir, full));
      hash.update("\0");
      hash.update(readFileSync(full));
      hash.update("\0");
    }
  }
  return hash.digest("hex");
}

try {
  const fingerprint = currentFingerprint();
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(STAMP_PATH, "utf8")).fingerprint ?? null;
  } catch {
    // No stamp yet (fresh install or first run): treat as changed so any
    // pre-existing cache of unknown provenance is cleared once.
  }
  if (previous !== fingerprint) {
    const cleared = [];
    for (const dir of CACHE_DIRS) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        cleared.push(relative(repoRoot, dir));
      }
    }
    writeFileSync(STAMP_PATH, JSON.stringify({ fingerprint }, null, 2) + "\n");
    if (cleared.length > 0) {
      console.log(
        `[memorize] Cleared stale Vite dep cache (${cleared.join(", ")}) — @memorize/core/types dist changed since it was built.`,
      );
    }
  }
} catch (error) {
  console.warn(
    `[memorize] Vite cache guard skipped: ${error instanceof Error ? error.message : String(error)}`,
  );
}
