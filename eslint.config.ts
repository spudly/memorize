import { base, jest, react, reactNative, typescriptPendingIgnores } from "@spudly/eslint-config";

// Shared config: @spudly/eslint-config (ported from Eciperay's
// eslint.config.ts). This repo composes the subsets that match its code:
// no server (no `node` export) and no Tailwind. Rule groups that need
// directory scoping ship rules-only in the package, so any paths below
// are attached here, in the consuming repo.
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
    ],
  },
  // typescript-eslint does not support TypeScript 7 yet (it caps
  // TypeScript at <6.1) and it was the only TS parser, so TS/TSX files
  // are not linted for now — `npm run typecheck` is the correctness
  // gate until typescript-eslint ships TS7 support and the package
  // gains a real typescript section (see the package README's restore
  // path). Plain JS files (.cjs/.mjs) are still linted.
  ...typescriptPendingIgnores,
  ...base,
  ...react,
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
];
