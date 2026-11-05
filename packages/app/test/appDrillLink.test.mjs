/**
 * Contract test for the native drill deep link (DS #425, #96):
 * `memorize://drill/<id>` is the canonical drill destination on
 * native. The app package has no component-test harness, so this
 * pins App.tsx's wiring by scanning its source with comments
 * stripped:
 *
 * 1. Both entry paths — cold start (Linking.getInitialURL) and
 *    warm opens (the Linking "url" event) — route the URL through
 *    drillIdFromUrl and hand the decoded id to setDrillingId.
 * 2. The matcher is anchored to the drill route: a single non-empty
 *    id segment (no /, ?, or #), one optional trailing slash, and
 *    percent-decoding with a raw-id fallback for malformed escapes
 *    — so non-drill URLs, empty ids, and extra path segments never
 *    open a drill.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "App.tsx");

function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/^\s*\/\/.*$/gm, "");
}

const code = stripComments(readFileSync(appPath, "utf8"));

test("cold start and url events both route drill links to the drill screen", () => {
  assert.match(code, /Linking\.getInitialURL\(\)\.then\(\(url\) => \{/);
  assert.match(code, /Linking\.addEventListener\("url", \(event\) => \{/);
  assert.match(code, /const id = drillIdFromUrl\(url\);/);
  assert.match(code, /const id = drillIdFromUrl\(event\.url\);/);
  assert.equal(code.match(/setDrillingId\(id\)/g)?.length, 2, "both paths hand the id over");
});

test("the matcher accepts only the canonical drill route", () => {
  assert.ok(
    code.includes(String.raw`/^memorize:\/\/drill\/([^/?#]+)\/?$/.exec(url)`),
    "anchored drill-route matcher: one id segment, optional trailing slash",
  );
  assert.match(code, /if \(!match\?\.\[1\]\) \{\s*return null;/, "empty ids do not match");
  assert.match(code, /return decodeURIComponent\(match\[1\]\);/);
  assert.match(
    code,
    /\} catch \{\s*return match\[1\];/,
    "malformed escapes fall back to the raw id",
  );
});
