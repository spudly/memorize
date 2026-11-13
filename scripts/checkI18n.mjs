/**
 * Catalog strictness check (#110): fails the test run when
 *  - en-XA does not cover exactly the en-US message ids,
 *  - any en-US catalog entry has an empty translation, or
 *  - source references a message id (`id: "..."`) that is missing
 *    from the en-US catalog (a missing key that would silently fall
 *    back at runtime).
 * Together with `lingui compile --strict` in the test script, this
 * is the "missing keys fail the build" gate for this package.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Shared by @memorize/app and @memorize/web (#117 Phase 2: the two
// per-package copies were byte-identical). Each package invokes this
// script from its own directory via its `i18n:check` script, so the
// package root is the working directory.
const root = process.cwd();

function parsePo(name) {
  const content = readFileSync(join(root, "src", "locales", name), "utf8");
  const entries = new Map();
  let current = null;
  let field = null;
  for (const line of content.split("\n")) {
    if (line.startsWith("msgid ")) {
      current = { msgid: JSON.parse(line.slice(6)), msgstr: "" };
      field = "msgid";
      if (current.msgid !== "") {
        entries.set(current.msgid, current);
      }
    } else if (line.startsWith("msgstr ") && current) {
      current.msgstr = JSON.parse(line.slice(7));
      field = "msgstr";
    } else if (line.startsWith('"') && current && field && !line.startsWith('"#')) {
      try {
        current[field] += JSON.parse(line);
      } catch {
        // header continuation lines are not JSON-safe in every PO
      }
    }
  }
  return entries;
}

const enUS = parsePo("en-US.po");
const enXA = parsePo("en-XA.po");

assert.deepEqual(
  [...enXA.keys()].sort(),
  [...enUS.keys()].sort(),
  "en-XA must cover exactly the en-US message ids",
);
// en-US (the source locale) must be fully translated. en-XA is the
// pseudo-locale: its msgstrs stay empty in the PO and Lingui
// generates the pseudo text from en-US at compile time
// (pseudoLocale in lingui.config.js), so parity of ids is what
// matters there.
for (const [id, entry] of enUS) {
  assert.notEqual(entry.msgstr, "", `en-US: empty translation for ${id}`);
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "locales") {
        yield* sourceFiles(path);
      }
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      yield path;
    }
  }
}

const referenced = new Set();
for (const file of sourceFiles(join(root, "src"))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bid:\s*"([a-z][\w-]*(?:\.[\w-]+)+)"/g)) {
    referenced.add(match[1]);
  }
}
for (const id of referenced) {
  assert.ok(enUS.has(id), `source references missing catalog id: ${id}`);
}

console.log(
  `i18n check ok: ${enUS.size} messages, en-XA parity, ${referenced.size} referenced ids present`,
);
