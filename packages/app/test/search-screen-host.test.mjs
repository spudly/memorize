/**
 * Contract test for the SearchScreen host (#49): the screen renders
 * the DS VerseSearchPage and keeps all state and business logic
 * app-side. The app package has no component-test harness (core's
 * jest suites cover the logic packages; the app is covered by
 * typecheck, the Android CI build, and the web e2e suite), so —
 * like the design system's own page contract tests — this pins the
 * host's wiring by scanning its source with comments stripped:
 *
 * 1. The view is VerseSearchPage from "@spudly/ui/pages"; the old
 *    hand-composed view (root @spudly/ui primitives + a FlatList in
 *    the screen) is gone.
 * 2. The search state (query, results, error, busy) stays in the
 *    screen, the search still runs against the app's data source,
 *    and the error composition (message or "Search failed") is the
 *    app's.
 * 3. Results cross the boundary as {id, reference, text}
 *    view-models, and an add reported by id is resolved back to the
 *    full Verse the store action takes.
 * 4. Every VerseSearchPage prop is wired to the app's state and
 *    callbacks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const screenPath = join(here, "..", "src", "screens", "SearchScreen.tsx");

function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/^\s*\/\/.*$/gm, "");
}

const code = stripComments(readFileSync(screenPath, "utf8"));

test("the screen renders VerseSearchPage from the pages subpath", () => {
  assert.match(code, /import\s*\{[^}]*VerseSearchPage[^}]*\}\s*from\s*"@spudly\/ui\/pages"/);
  assert.match(code, /<VerseSearchPage/);
});

test("the old hand-composed view does not survive in the screen", () => {
  assert.doesNotMatch(code, /from\s*"@spudly\/ui"/, "no root @spudly/ui view imports remain");
  assert.doesNotMatch(code, /FlatList/, "the results list is the page's, not the screen's");
  assert.doesNotMatch(code, /Search verses/, "the heading is the page's, not the screen's");
});

test("search state and execution stay app-side", () => {
  assert.match(code, /useState\(""\)/);
  assert.match(code, /useState<Verse\[\]>\(\[\]\)/);
  assert.match(code, /useState<string \| null>\(null\)/);
  assert.match(code, /useState\(false\)/);
  assert.match(code, /dataSource\.search\(query\)/);
  assert.match(code, /e instanceof Error \? e\.message : "Search failed"/);
});

test("results map to the page's view-model fields", () => {
  assert.match(code, /VerseSearchPageItem/);
  assert.match(code, /id: verse\.id/);
  assert.match(code, /reference: verse\.reference/);
  assert.match(code, /text: verse\.text/);
});

test("an add by id resolves back to the full Verse for the store", () => {
  assert.match(code, /results\.find\(\(v\) => v\.id === verseId\)/);
  assert.match(code, /store\.actions\.addVerse\(verse\)/);
});

test("every page prop is wired to app state and callbacks", () => {
  for (const wiring of [
    /query=\{query\}/,
    /onQueryChange=\{setQuery\}/,
    /onSearch=\{\(\) => void runSearch\(\)\}/,
    /isSearching=\{busy\}/,
    /usingDemo=\{usingDemo\}/,
    /errorMessage=\{error\}/,
    /results=\{items\}/,
    /onAddVerse=\{handleAddVerse\}/,
  ]) {
    assert.match(code, wiring);
  }
});
