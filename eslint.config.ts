import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

// typescript-eslint was removed alongside the TypeScript 7 upgrade: it
// caps TypeScript at <6.1 and cannot parse TS7. Without it ESLint has no
// TypeScript parser, so .ts/.tsx files are ignored below and are NOT
// linted for now — `npm run typecheck` is the correctness gate for TS
// until typescript-eslint ships TS7 support and is restored (with its
// recommended rules, which is why no @typescript-eslint/* rules remain
// configured here). Plain JS files (.cjs/.mjs) are still linted.
export default [
  {
    ignores: [
      "**/dist/**",
      // Playwright e2e build outputs (packages/web/playwright.config.ts).
      "**/dist-e2e-*/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/coverage/**",
      // See note above: no TS parser until typescript-eslint returns.
      "**/*.ts",
      "**/*.tsx",
    ],
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
      },
    },
  },
  {
    // Standalone Node tooling scripts (e.g. the web predev cache guard):
    // everything they use is imported from node:* modules except console.
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
  },
  js.configs.recommended,
  prettierConfig,
];
