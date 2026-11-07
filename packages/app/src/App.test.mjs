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
 * 3. DrillScreen is keyed by the drilled verse id, so a warm link
 *    that changes the verse remounts the screen instead of carrying
 *    the previous verse's drill state into the new verse.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "App.tsx");

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

test("the drill screen remounts when the drilled verse changes", () => {
  // DrillScreen initializes its round/peeks state from the verse on
  // mount only, so a warm link that swaps drillingId while a drill is
  // open must remount it — otherwise the previous verse's progress
  // state would be displayed and saved against the new verse.
  assert.match(code, /<DrillScreen\s+key=\{drillingId\}/, "DrillScreen is keyed by drillingId");
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

// ---------------------------------------------------------------------------
// App-shell font/config contract tests, merged from the former
// appShellFontConfig.test.mjs under the colocation convention (#108):
// both suites target the app shell (src/App.tsx / src/tamaguiConfig.ts),
// so they share the single colocated src/App.test.mjs.
// ---------------------------------------------------------------------------

const appCode = readFileSync(join(here, "App.tsx"), "utf8");
const configCode = readFileSync(join(here, "tamaguiConfig.ts"), "utf8");

const app = stripComments(appCode);
const config = stripComments(configCode);

test("the app creates its Tamagui config via the DS factory and Memorize theme", () => {
  assert.match(config, /createTamaguiConfig\(memorizeTheme\)/);
  assert.match(config, /from\s*"@spudly\/ui"/);
  assert.doesNotMatch(app, /tamaguiConfig\s*\}\s*from\s*"@spudly\/ui"/);
  assert.match(app, /config=\{appTamaguiConfig\}/);
});

test("Raleway and Alegreya are registered under their exact names from the bundled fonts", () => {
  assert.match(app, /useFonts\(\{\s*Raleway\s*,\s*Alegreya\s*\}\)/);
  assert.match(app, /from\s*"\.\.\/assets\/fonts\/Raleway\.ttf"/);
  assert.match(app, /from\s*"\.\.\/assets\/fonts\/Alegreya\.ttf"/);
  assert.match(app, /from\s*"expo-font"/);
});

test("the loading gate waits for the font to load", () => {
  assert.match(app, /!ready \|\| !fontsLoaded/);
});
