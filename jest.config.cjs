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

module.exports = {
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
      transform,
    },
  ],
};
