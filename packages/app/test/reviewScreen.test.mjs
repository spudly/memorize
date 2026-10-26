/**
 * Contract test for the Review screen's @spudly/ui rewire
 * (spudly/design-system#49). ReviewScreen is now a thin host: it
 * keeps the spaced-repetition business logic (the due computation
 * and the outcome recording) and drives the DS MemorizeReviewPage
 * entirely through props. These source scans pin that mapping —
 * the same rationale as the design-system repo's page contract
 * tests: the invariant is a per-literal property of the source,
 * and this package has no JS renderer for its screens. Comments
 * are stripped before scanning so prose cannot satisfy — or
 * accidentally trip — the patterns.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const strip = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
const screenCode = strip(
  readFileSync(join(here, "..", "src", "screens", "ReviewScreen.tsx"), "utf8"),
);
const appCode = strip(readFileSync(join(here, "..", "src", "App.tsx"), "utf8"));

test("the screen renders the DS MemorizeReviewPage from the pages subpath", () => {
  assert.match(screenCode, /import \{ MemorizeReviewPage/);
  assert.match(screenCode, /from "@spudly\/ui\/pages"/);
  assert.match(screenCode, /<MemorizeReviewPage/);
});

test("the due list is computed app-side and crosses as { id, reference, text }", () => {
  assert.match(screenCode, /dueVerses\(store\.getState\(\)\.data\.verses, new Date\(\)\)/);
  assert.match(screenCode, /id: item\.verse\.id/);
  assert.match(screenCode, /reference: item\.verse\.reference/);
  assert.match(screenCode, /text: item\.verse\.text/);
});

test("the two page callbacks record the app's two review outcomes by verse id", () => {
  assert.match(screenCode, /onRememberedPress/);
  assert.match(screenCode, /recordReview\(verseId, "remembered"\)/);
  assert.match(screenCode, /onForgotPress/);
  assert.match(screenCode, /recordReview\(verseId, "forgot"\)/);
});

test("the screen renders no list, cards, or empty state of its own anymore", () => {
  assert.doesNotMatch(screenCode, /FlatList|<Card|EmptyState/);
});

test("App registers the bundled Raleway variable font under the DS family name", () => {
  // The registration shape pinned here is the one that landed on main
  // via the session rewire (spudly/memorize#34): the ttf import is
  // bound to the name Raleway and handed to useFonts under that exact
  // family name, and first render gates on the load. #127 extends the
  // same call with Alegreya, the Quiet Dawn verse font (design-system
  // #66) the DS theme contract also expects the app to bundle; the
  // Alegreya assertions live in appShellFontConfig.test.mjs.
  assert.match(appCode, /useFonts\(\{ Raleway, Alegreya \}\)/);
  assert.match(appCode, /assets\/fonts\/Raleway\.ttf/);
  assert.match(appCode, /!ready \|\| !fontsLoaded/);
});
