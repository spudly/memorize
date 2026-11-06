import type { AppData } from "@memorize/types";

/** Minimal async key-value interface; implemented per platform. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DATA_KEY = "memorize:data:v1";

/**
 * Storage key that held the user API key before #101 removed it
 * end-to-end. Existing installs may still carry an entry under this
 * key; the store deletes it on initialization (see
 * {@link LocalStore.clearLegacySecrets}) so no dead credential is
 * left on device.
 */
export const LEGACY_SECRETS_KEY = "memorize:secrets:v1";

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

  /**
   * Deletes any pre-#101 secrets entry (the removed user API key).
   * Best-effort: a storage failure here must never block startup —
   * the entry is inert either way, since nothing reads it anymore.
   */
  async clearLegacySecrets(): Promise<void> {
    try {
      await this.storage.removeItem(LEGACY_SECRETS_KEY);
    } catch {
      // Swallow: cleanup only; see the doc comment above.
    }
  }
}
