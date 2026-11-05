/**
 * Contract test for the web SearchTab host (#96): the web mirror of
 * the native SearchScreen host test. The web package has no
 * component-test harness for hosts, so this pins the host's wiring
 * by scanning its source with comments stripped — the same
 * transitions the native test pins, so the two hosts cannot drift:
 *
 * 1. A failed search clears results and does not mark the search
 *    completed; successful results are set before the searched flag.
 * 2. Fire-and-forget saves go through a rejection-handled path that
 *    surfaces failures on the page's error channel (#91 made
 *    addVerse's persistence awaitable, so it can reject).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tabPath = join(here, "..", "src", "components", "SearchTab.tsx");

function stripComments(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/^\s*\/\/.*$/gm, "");
}

const code = stripComments(readFileSync(tabPath, "utf8"));

test("a failed search clears results and is not a completed search", () => {
  const runSearch = code.slice(code.indexOf("const runSearch"), code.indexOf("const items"));
  const catchBlock = runSearch.slice(runSearch.indexOf("} catch (e) {"));
  assert.match(catchBlock, /setResults\(\[\]\)/);
  assert.match(catchBlock, /setSearched\(false\)/);
  assert.doesNotMatch(catchBlock, /setSearched\(true\)/);
  const successBlock = runSearch.slice(0, runSearch.indexOf("} catch (e) {"));
  assert.ok(
    successBlock.indexOf("setResults(found)") < successBlock.indexOf("setSearched(true)"),
    "successful results are set before the searched flag",
  );
});

test("fire-and-forget saves handle addVerse rejections on the error channel", () => {
  assert.match(code, /store\.actions\.addVerse\(verse\)\.catch\(/);
  assert.match(code, /e instanceof Error \? e\.message : "Couldn't save that verse"/);
  assert.match(code, /saveVerse\(result\)/, "the reconcile loop saves through the handled path");
  assert.match(code, /saveVerse\(verse\)/, "a reported add saves through the handled path");
  assert.doesNotMatch(code, /void store\.actions\.addVerse/);
});
