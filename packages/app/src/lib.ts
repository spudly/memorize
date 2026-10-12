import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SETTINGS,
  DemoDataSource,
  GospelEngineDataSource,
  type KeyValueStorage,
  type ScriptureDataSource,
} from "@memorize/core";

/** KeyValueStorage backed by AsyncStorage. */
export const appStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/** Full-library source when a key is set, offline demo data otherwise. */
export function dataSourceFor(apiKey: string | null): ScriptureDataSource {
  if (apiKey) {
    return new GospelEngineDataSource(DEFAULT_SETTINGS.gospelEngineBaseUrl, apiKey);
  }
  return new DemoDataSource();
}

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
