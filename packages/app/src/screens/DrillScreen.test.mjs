/**
 * Contract test for the Drill screen's awaited-persistence wiring
 * (#91). DrillScreen is a thin host over the DS
 * MemorizationSessionPage; this package has no JS renderer for its
 * screens (see reviewScreen.test.mjs for the rationale), so these
 * source scans pin the wiring the #91 fix depends on: drill saves
 * are awaited, a failed save surfaces a message instead of being
 * dropped, and completion navigation goes through finishDrill's
 * still-active guard. The completion flow itself is behavior-tested
 * in src/screens/drillViewModel.test.ts. Comments are stripped before
 * scanning so prose cannot satisfy the patterns.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const strip = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
const screenCode = strip(readFileSync(join(here, "DrillScreen.tsx"), "utf8"));

test("drill progress saves are awaited inside try/catch", () => {
  const awaitedSaves = screenCode.match(/try \{\s*await store\.actions\.setDrillProgress/g) ?? [];
  assert.equal(awaitedSaves.length, 2);
  assert.match(screenCode, /catch \{\s*setMessage\("Couldn't save your progress/);
});

test("completion goes through finishDrill with the still-active guard", () => {
  assert.match(screenCode, /await finishDrill\(\{/);
  assert.match(screenCode, /complete: \(\) => store\.actions\.completeDrill\(verseId\)/);
  assert.match(screenCode, /isActive: \(\) => activeRef\.current/);
  assert.match(
    screenCode,
    /onSaveError: \(\) => \{\s*setMessage\("Couldn't save finishing the drill/,
  );
});

test("leaving the screen marks it inactive via the ref's effect cleanup", () => {
  assert.match(screenCode, /const activeRef = useRef\(true\)/);
  assert.match(screenCode, /return \(\) => \{\s*activeRef\.current = false;/);
});
