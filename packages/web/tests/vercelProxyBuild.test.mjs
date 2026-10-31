import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Regression guard for #63: the production (Vercel) build must compile
 * with VITE_USE_GOSPEL_PROXY=1 so no-key visitors search the full
 * library through the edge proxy instead of the built-in demo set.
 *
 * The flag reaching the *build* is the whole point: the plain "env" key
 * in vercel.json is runtime configuration and never reached the Vite
 * build, so the 2026-10-28 production bundle constant-folded the proxy
 * branch of src/lib/gospel.ts away. Vite reads .env.production from
 * disk at build time, which no deployment-env plumbing can lose.
 */

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readWebFile(name) {
  return readFileSync(join(webRoot, name), "utf8");
}

test(".env.production sets VITE_USE_GOSPEL_PROXY=1 for production builds", () => {
  const envProduction = readWebFile(".env.production");
  assert.match(envProduction, /^VITE_USE_GOSPEL_PROXY=1$/m);
});

test("vercel.json also declares the flag as build-time env", () => {
  const vercel = JSON.parse(readWebFile("vercel.json"));
  assert.equal(vercel.build?.env?.VITE_USE_GOSPEL_PROXY, "1");
});
