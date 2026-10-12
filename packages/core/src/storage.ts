import type { AppData } from "@memorize/types";

/** Minimal async key-value interface; implemented per platform. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DATA_KEY = "memorize:data:v1";
export const SECRETS_KEY = "memorize:secrets:v1";

/**
 * Secrets stay on the device: the gospel-engine API key and the last Drive
 * sync timestamp. Never written to Google Drive.
 */
interface LocalSecrets {
  gospelEngineKey?: string;
  lastSyncedAt?: string;
}

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

  private async loadSecrets(): Promise<LocalSecrets> {
    const raw = await this.storage.getItem(SECRETS_KEY);
    if (raw === null) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? (parsed as LocalSecrets) : {};
    } catch {
      return {};
    }
  }

  private async saveSecrets(secrets: LocalSecrets): Promise<void> {
    await this.storage.setItem(SECRETS_KEY, JSON.stringify(secrets));
  }

  async getApiKey(): Promise<string | null> {
    const secrets = await this.loadSecrets();
    return secrets.gospelEngineKey ?? null;
  }

  async setApiKey(key: string): Promise<void> {
    const secrets = await this.loadSecrets();
    secrets.gospelEngineKey = key;
    await this.saveSecrets(secrets);
  }

  async clearApiKey(): Promise<void> {
    const secrets = await this.loadSecrets();
    delete secrets.gospelEngineKey;
    await this.saveSecrets(secrets);
  }

  async getLastSyncedAt(): Promise<string | null> {
    const secrets = await this.loadSecrets();
    return secrets.lastSyncedAt ?? null;
  }

  async setLastSyncedAt(iso: string): Promise<void> {
    const secrets = await this.loadSecrets();
    secrets.lastSyncedAt = iso;
    await this.saveSecrets(secrets);
  }
}
