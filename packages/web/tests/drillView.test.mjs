/**
 * Contract test for DrillView's awaited-persistence wiring (#91).
 * The web package has no component renderer in its test setup, so
 * these source scans pin the wiring the #91 fix depends on, the
 * same approach as the app package's screen contract tests: drill
 * saves are awaited, a failed save surfaces a message instead of
 * being dropped, and completion navigates back only after the save
 * lands and only while the view is still mounted (a late save must
 * not clear a different drill the user has since opened). The
 * store's awaitable persistence is behavior-tested in
 * packages/core/tests/store.test.ts. Comments are stripped before
 * scanning so prose cannot satisfy the patterns.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const strip = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
const drillCode = strip(readFileSync(join(webRoot, "src/components/DrillView.tsx"), "utf8"));

test("drill progress saves are awaited inside try/catch", () => {
  const awaitedSaves = drillCode.match(/try \{\s*await store\.actions\.setDrillProgress/g) ?? [];
  assert.equal(awaitedSaves.length, 2);
  assert.match(drillCode, /catch \{\s*setMessage\("Couldn't save your progress/);
});

test("completion save is awaited and failure keeps the user on the drill", () => {
  assert.match(drillCode, /try \{\s*await store\.actions\.completeDrill\(verseId\);/);
  assert.match(drillCode, /catch \{\s*setMessage\("Couldn't save finishing the drill/);
});

test("completion navigates back only while the view is still mounted", () => {
  assert.match(drillCode, /const activeRef = useRef\(true\)/);
  assert.match(drillCode, /return \(\) => \{\s*activeRef\.current = false;/);
  assert.match(drillCode, /if \(activeRef\.current\) \{\s*onBack\(\);/);
});
