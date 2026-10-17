module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  // @swc/jest is transpile-only (ts-jest needs the TS JS compiler API, which
  // native TypeScript 7 no longer exposes). Type safety stays enforced by
  // `npm run typecheck` under TS7.
  transform: {
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
  },
};
