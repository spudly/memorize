/**
 * Contract test for the @spudly/ui 1.4.0 app-shell changes that
 * ride along with the #49 VerseSearchPage rewire:
 *
 * 1. The Tamagui config is created by the app via the DS factory
 *    with the Memorize theme (the prebuilt `tamaguiConfig` export
 *    was removed in @spudly/ui 1.x — Tamagui v3 resolves against
 *    the single most recently created global config, so the app
 *    must create its own, exactly once, in app-owned code; see
 *    spudly/eciperay#149 for the wrong-brand failure this avoids).
 * 2. Raleway — the UI font every @spudly/ui theme names
 *    (design-system #65) — is registered under the exact name
 *    "Raleway" from the bundled variable font, and the app's
 *    loading gate waits for the font before first render (the
 *    app shell's registration/gate is main's version, landed by
 *    the session rewire and kept verbatim by this dedupe).
 * 3. Alegreya — the verse-text font the Quiet Dawn theme names
 *    (design-system #66) — is bundled and registered the same
 *    way under its exact name "Alegreya" (#127): the theme
 *    contract expects the app to bundle it, and without the
 *    registration native verse text falls back to the serif
 *    stack.
 *
 * Source-scan, like the DS page contract tests: the app package
 * has no component-test harness.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appCode = readFileSync(join(here, "..", "src", "App.tsx"), "utf8");
const configCode = readFileSync(join(here, "..", "src", "tamaguiConfig.ts"), "utf8");

function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/^\s*\/\/.*$/gm, "");
}

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
