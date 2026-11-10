// Root Jest config (issue #108): Jest configuration lives at the repo
// root per Stephen's colocation convention rulings (2026-11-07). One
// project per package that runs Jest; each package's `test` script
// invokes this config with its project selected, e.g.
// `jest --config ../../jest.config.cjs --selectProjects core`.
//
// @swc/jest is transpile-only (ts-jest needs the TS JS compiler API,
// which native TypeScript 7 no longer exposes). Type safety stays
// enforced by `npm run typecheck` under TS7.
const transform = {
  "^.+\\.ts$": [
    "@swc/jest",
    {
      jsc: {
        parser: { syntax: "typescript", tsx: false },
        target: "es2022",
      },
      module: { type: "commonjs" },
    },
  ],
};

// The app package's i18n modules (#110) import @lingui/core, which is
// ESM-only; Jest's CommonJS registry cannot require it untransformed.
// The app project therefore also transpiles the Lingui ESM packages
// in node_modules to CommonJS. (The core project imports no Lingui
// code and keeps the plain transform.)
const esmTransform = [
  "@swc/jest",
  {
    jsc: {
      parser: { syntax: "ecmascript" },
      target: "es2022",
    },
    module: { type: "commonjs" },
  },
];

const appTransform = {
  ...transform,
  "^.+\\.mjs$": esmTransform,
  "^.+\\.js$": esmTransform,
};

const os = require("node:os");

module.exports = {
  // Cap the local worker pool: Jest sizes its pool from the host's
  // reported core count, which oversubscribes constrained dev machines
  // (a host reporting 4 cores behind a much smaller CPU allocation gets
  // a pool that thrashes instead of helping). maxWorkers is a global
  // option, so set here it governs the shared pool across both projects
  // below. The local cap is the lesser of 2 and Jest's own default
  // sizing (cores − 1), so a one-CPU machine keeps its single worker.
  // In CI the option is omitted entirely, leaving Jest's default —
  // and CI parallelism — exactly as before.
  ...(process.env.CI
    ? {}
    : { maxWorkers: Math.max(1, Math.min(2, os.availableParallelism() - 1)) }),
  projects: [
    {
      displayName: "core",
      rootDir: "<rootDir>/packages/core",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      transform,
    },
    {
      displayName: "app",
      rootDir: "<rootDir>/packages/app",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      transform: appTransform,
      transformIgnorePatterns: ["node_modules/(?!(@lingui|@messageformat|@noble)/)"],
    },
  ],
};
