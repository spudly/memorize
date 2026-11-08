// Lingui configuration for @memorize/web (#110).
// Catalogs live in src/locales: en-US is the source locale and en-XA is
// the standing pseudo-locale (generated from en-US, accented/expanded)
// used in the test matrix until real translations arrive.
import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

export default defineConfig({
  sourceLocale: "en-US",
  locales: ["en-US", "en-XA"],
  pseudoLocale: "en-XA",
  fallbackLocales: { default: "en-US" },
  format: formatter({ lineNumbers: false }),
  // Compiled catalogs are committed as .ts modules imported by
  // src/locales/i18n.ts (isomorphic: no .po import transform needed
  // in Metro, Jest, or a future SSR server).
  compileNamespace: "ts",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}",
      include: ["<rootDir>/src"],
      exclude: ["**/*.test.*", "**/locales/**"],
    },
  ],
});
