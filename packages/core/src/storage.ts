import type { AppData } from "@memorize/types";

/** Minimal async key-value interface; implemented per platform. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DATA_KEY = "memorize:data:v1";

/**
 * Local persistence for the app data snapshot. There is no secret
 * storage anymore (#101): the user API key was removed end-to-end —
 * web search is server-key-only via the edge proxy and native search
 * uses the offline demo set, so nothing secret is kept on device.
 */
export class LocalStore {
  constructor(private readonly storage: KeyValueStorage) {}

  async loadData(): Promise<AppData | null> {
    const raw = await this.storage.getItem(DATA_KEY);
    if (raw === null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? (parsed as AppData) : null;
    } catch {
      return null;
    }
  }

  async saveData(data: AppData): Promise<void> {
    await this.storage.setItem(DATA_KEY, JSON.stringify(data));
  }
}
