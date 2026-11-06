import { DemoDataSource, GospelEngineDataSource, type ScriptureDataSource } from "@memorize/core";

/**
 * Whether dataSourceFor() resolves to the offline demo set.
 * Proxy builds search the full library through the server key, so
 * demo mode is purely a build-time property now (#101: there is
 * no user API key on any platform) — UI that describes the active
 * source (demo notice, placeholder examples) must use this.
 */
export function isDemoDataSource(): boolean {
  return import.meta.env.VITE_USE_GOSPEL_PROXY !== "1";
}

/**
 * The scripture data source: the proxied full library on proxy
 * builds, the offline demo set otherwise. There is no per-user
 * key (#101) — web search is server-key-only by design.
 */
export function dataSourceFor(): ScriptureDataSource {
  // With VITE_USE_GOSPEL_PROXY=1 (production builds: .env.production), requests go
  // to /api/* on this origin and are forwarded by the edge proxy in
  // packages/web/api — the API sends no CORS headers, so browsers block
  // direct cross-origin calls. The proxy injects the API key from the
  // GOSPEL_ENGINE_API_KEY server secret, so the client sends no key.
  if (import.meta.env.VITE_USE_GOSPEL_PROXY === "1") {
    return new GospelEngineDataSource("", "");
  }
  return new DemoDataSource();
}
