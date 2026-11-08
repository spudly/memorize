/**
 * i18n foundation tests for @memorize/web (#110): the web package
 * has no TS test runner, so these run in node --test against the
 * committed compiled catalogs (the exact artifacts i18n.ts loads)
 * plus source scans pinning the root wiring — the same approach as
 * the package's other contract tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { setupI18n } from "@lingui/core";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..", "..");

function loadCompiledMessages(locale) {
  const source = readFileSync(join(here, `${locale}.ts`), "utf8");
  const match = /JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(source);
  assert.ok(match, `${locale}: compiled catalog carries a JSON messages payload`);
  return JSON.parse(JSON.parse(match[1]));
}

function instanceFor(locale) {
  const instance = setupI18n();
  instance.loadAndActivate({ locale, messages: loadCompiledMessages(locale) });
  return instance;
}

const RETRY = {
  id: "drill.retryFeedback",
  message:
    "Not quite — you peeked {peeks, plural, one {# time} other {# times}} on {blanks, plural, one {# blank} other {# blanks}}. Try the round again.",
};

test("the en-US compiled catalog renders the migrated strings", () => {
  const instance = instanceFor("en-US");
  assert.equal(instance._({ id: "app.title", message: "Memorize" }), "Memorize");
  assert.equal(instance._({ id: "tab.myVerses", message: "My verses" }), "My verses");
  assert.equal(
    instance._({
      id: "verses.nextReview",
      message: "Next review: {date}",
      values: { date: "11/9/2026" },
    }),
    "Next review: 11/9/2026",
  );
});

test("the ICU plural message renders singular and plural in en-US", () => {
  const instance = instanceFor("en-US");
  assert.equal(
    instance._({ ...RETRY, values: { peeks: 1, blanks: 1 } }),
    "Not quite — you peeked 1 time on 1 blank. Try the round again.",
  );
  assert.equal(
    instance._({ ...RETRY, values: { peeks: 4, blanks: 9 } }),
    "Not quite — you peeked 4 times on 9 blanks. Try the round again.",
  );
});

test("the en-XA pseudo-locale renders the same plurals, pseudo-localized", () => {
  const instance = instanceFor("en-XA");
  const one = instance._({ ...RETRY, values: { peeks: 1, blanks: 2 } });
  const many = instance._({ ...RETRY, values: { peeks: 4, blanks: 2 } });
  assert.match(one, /ţĩḿē/);
  assert.doesNotMatch(one, /ţĩḿēś/);
  assert.match(many, /ţĩḿēś/);
  assert.match(instance._({ id: "tab.search", message: "Search" }), /Śēàŕćĥ/);
});

test("the root wiring activates a locale before first render", () => {
  const main = readFileSync(join(webRoot, "src/main.tsx"), "utf8");
  assert.match(main, /activateForClient/);
  assert.match(main, /from ".\/locales\/i18n"/);
  const app = readFileSync(join(webRoot, "src/App.tsx"), "utf8");
  assert.match(app, /<I18nProvider i18n=\{i18n\}>/);
  const viteConfig = readFileSync(join(webRoot, "vite.config.ts"), "utf8");
  assert.match(viteConfig, /lingui\(\)/);
  assert.match(viteConfig, /linguiTransformerBabelPreset\(\)/);
  assert.match(viteConfig, /@rolldown\/plugin-babel/);
});

test("the i18n module keeps the decided precedence and no browser-only singleton", () => {
  const i18nSource = readFileSync(join(here, "i18n.ts"), "utf8");
  assert.match(i18nSource, /export function resolveLocale/);
  assert.match(i18nSource, /stored/);
  assert.match(i18nSource, /export function createI18n/);
  assert.match(i18nSource, /export async function loadCatalog/);
});
