import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e for the Memorize web app (issue #30).
 *
 * Two projects, two in-job builds of the web package, both served by
 * `vite preview` (which also stands in for the Vercel edge proxy — see
 * vite.config.ts):
 *
 * - "demo" (port 4173): the default build. With no API key configured the
 *   app uses the built-in DemoDataSource, so flows run fully offline
 *   against the demo verse set.
 * - "proxy" (port 4174): built with VITE_USE_GOSPEL_PROXY=1, so search
 *   goes through GospelEngineDataSource against /api/*. The specs
 *   intercept those requests and fulfill them with fixtures in the
 *   documented gospel-engine shapes (packages/core/docs/api-notes.md),
 *   which pins the API field mapping in CI. No test talks to the live
 *   engine or a real account.
 */
const DEMO_PORT = 4173;
const PROXY_PORT = 4174;

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "demo",
      testDir: "./e2e/demo",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${DEMO_PORT}`,
      },
    },
    {
      name: "proxy",
      testDir: "./e2e/proxy",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${PROXY_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command:
        "npx vite build --outDir dist-e2e-demo && " +
        `npx vite preview --host 127.0.0.1 --port ${DEMO_PORT} --strictPort --outDir dist-e2e-demo`,
      port: DEMO_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command:
        "VITE_USE_GOSPEL_PROXY=1 npx vite build --outDir dist-e2e-proxy && " +
        `npx vite preview --host 127.0.0.1 --port ${PROXY_PORT} --strictPort --outDir dist-e2e-proxy`,
      port: PROXY_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
