import { base, jest, react, reactNative, typescript } from "@spudly/eslint-config";
import { reactPending } from "@spudly/eslint-config/react-pending";

// Shared config: @spudly/eslint-config (ported from Eciperay's
// eslint.config.ts). This repo composes the subsets that match its code:
// no server (no `node` export) and no Tailwind. Rule groups that need
// directory scoping ship rules-only in the package, so any paths below
// are attached here, in the consuming repo.
export default [
  {
    ignores: [
      "**/dist/**",
      // Playwright e2e build outputs (root playwright.config.ts).
      "**/dist-e2e-*/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/coverage/**",
      // Compiled Lingui catalogs: generated files, not authored code.
      "**/locales/en-US.ts",
      "**/locales/en-XA.ts",
    ],
  },
  // TypeScript files are linted with type-aware rules again:
  // @spudly/eslint-config 0.8.0 restored its real `typescript` section
  // (eslint-config #67). It works without waiting for typescript-eslint
  // to support TypeScript 7 because the side-by-side setup aliases the
  // resolvable `typescript` package to @typescript/typescript6 (which
  // satisfies typescript-eslint's <6.1 peer cap), while compilation and
  // `npm run typecheck` run the TypeScript 7 compiler by path via the
  // `typescript7` alias. The same side-by-side setup lets the
  // @eslint-react rule set load, so `reactPending` is composed
  // alongside `react` below.
  ...typescript,
  ...base,
  ...react,
  ...reactPending,
  ...reactNative,
  ...jest,
  {
    // Standalone Node tooling scripts (e.g. the web predev cache
    // guard): they run under Node, so Node globals apply and console
    // is their interface — the shared base's app-code no-console /
    // no-undef stance does not fit them. (This replaces the local
    // block the old config carried for the same files.)
    files: ["**/scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  {
    // Files excluded from their package tsconfig (tests are excluded
    // from the typecheck programs) or outside any tsconfig (the web
    // api/ edge functions and scripts/ stubs): lint them type-aware
    // against dedicated eslint tsconfigs that include them, instead of
    // the project service, which cannot find them.
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "packages/web/api/**/*.ts",
      "packages/web/scripts/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: [
          "./packages/app/tsconfig.eslint.json",
          "./packages/core/tsconfig.eslint.json",
          "./packages/web/tsconfig.eslint.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Vite's conventional client-types filename: renaming it would
    // break the convention every Vite tool expects.
    files: ["packages/web/src/vite-env.d.ts"],
    rules: {
      "unicorn/filename-case": "off",
    },
  },
  {
    // scripture.ts is a single-module scripture/markdown parser whose
    // public API is class-based by design (ScriptureApiError extends
    // Error for instanceof checks; the data sources are constructed
    // with `new` by both apps and the test suite), and whose length
    // is dominated by its book/alias data tables. Splitting it and
    // converting its classes are their own refactors, not lint fixes.
    files: ["packages/core/src/scripture.ts"],
    rules: {
      "max-lines": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // LocalStore is likewise a constructed public API (`new
    // LocalStore(storage)` in the store factory and tests).
    files: ["packages/core/src/storage.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
