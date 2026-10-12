import type { KeyValueStorage } from "@memorize/core";

/** KeyValueStorage backed by window.localStorage. */
export const webStorage: KeyValueStorage = {
  getItem: async (key) => window.localStorage.getItem(key),
  setItem: async (key, value) => {
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    window.localStorage.removeItem(key);
  },
};
