import {
  DEFAULT_SETTINGS,
  DemoDataSource,
  GospelEngineDataSource,
  type ScriptureDataSource,
} from "@memorize/core";

/** Full-library source when a key is set, offline demo data otherwise. */
export function dataSourceFor(apiKey: string | null): ScriptureDataSource {
  if (apiKey) {
    return new GospelEngineDataSource(DEFAULT_SETTINGS.gospelEngineBaseUrl, apiKey);
  }
  return new DemoDataSource();
}
