import AsyncStorage from "@react-native-async-storage/async-storage";
import { DemoDataSource, type KeyValueStorage, type ScriptureDataSource } from "@memorize/core";

/** KeyValueStorage backed by AsyncStorage. */
export const appStorage: KeyValueStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/**
 * The native scripture data source is always the offline demo set
 * (#101): there is no user API key anymore — web search is
 * server-key-only by design through its edge proxy, and native
 * has no proxy, so no key exists to call the engine directly with.
 */
export function dataSourceFor(): ScriptureDataSource {
  return new DemoDataSource();
}
