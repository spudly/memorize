import {
  DEFAULT_SETTINGS,
  DemoDataSource,
  GospelEngineDataSource,
  type ScriptureDataSource,
} from "@memorize/core";

/** Full-library source when a key is set, offline demo data otherwise. */
export function dataSourceFor(apiKey: string | null): ScriptureDataSource {
  // With VITE_USE_GOSPEL_PROXY=1 (set on Vercel via vercel.json), requests go
  // to /api/* on this origin and are forwarded by the edge proxy in
  // packages/web/api — the API sends no CORS headers, so browsers block
  // direct cross-origin calls. The proxy injects the API key from the
  // GOSPEL_ENGINE_API_KEY server secret, so no per-user key is needed here.
  if (import.meta.env.VITE_USE_GOSPEL_PROXY === "1") {
    return new GospelEngineDataSource("", apiKey ?? "");
  }
  if (apiKey) {
    return new GospelEngineDataSource(DEFAULT_SETTINGS.gospelEngineBaseUrl, apiKey);
  }
  return new DemoDataSource();
}
