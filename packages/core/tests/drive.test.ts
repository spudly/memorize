import { createEmptyAppData, type AppData } from "@memorize/types";
import {
  buildDrivePayload,
  forcePull,
  forcePush,
  syncWithDrive,
  type DriveClient,
  type DriveFileMeta,
} from "../src/drive";
import { LocalStore, type KeyValueStorage } from "../src/storage";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
}

/** In-memory DriveClient double. */
class MockDrive implements DriveClient {
  files = new Map<string, { name: string; content: string; modifiedTime: string }>();
  written: { id: string | null; content: string }[] = [];

  async findFile(name: string): Promise<DriveFileMeta | null> {
    for (const [id, file] of this.files) {
      if (file.name === name) {
        return { id, modifiedTime: file.modifiedTime };
      }
    }
    return null;
  }

  async readFile(id: string): Promise<string> {
    const file = this.files.get(id);
    if (!file) {
      throw new Error(`file not found: ${id}`);
    }
    return file.content;
  }

  async writeFile(
    id: string | null,
    name: string,
    _folderName: string,
    content: string,
  ): Promise<{ id: string }> {
    this.written.push({ id, content });
    if (id && this.files.has(id)) {
      const file = this.files.get(id) as { name: string; content: string; modifiedTime: string };
      this.files.set(id, {
        ...file,
        content,
        modifiedTime: new Date().toISOString(),
      });
      return { id };
    }
    const newId = `file-${this.files.size + 1}`;
    this.files.set(newId, {
      name,
      content,
      modifiedTime: new Date().toISOString(),
    });
    return { id: newId };
  }

  seedRemote(data: AppData): void {
    this.files.set("remote-1", {
      name: "memorize-data.json",
      content: JSON.stringify(data),
      modifiedTime: data.updatedAt,
    });
  }
}

function makeData(updatedAt: string): AppData {
  return { ...createEmptyAppData(), updatedAt };
}

describe("syncWithDrive", () => {
  test("pushes local data when there is no remote file", async () => {
    const store = new LocalStore(memoryStorage());
    const local = makeData("2026-01-02T00:00:00.000Z");
    await store.saveData(local);
    const drive = new MockDrive();

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("pushed");
    expect(drive.written).toHaveLength(1);
    expect(drive.written[0]?.id).toBeNull();
    expect(await store.getLastSyncedAt()).not.toBeNull();
  });

  test("pulls remote data when there is no local data", async () => {
    const store = new LocalStore(memoryStorage());
    const drive = new MockDrive();
    drive.seedRemote(makeData("2026-01-02T00:00:00.000Z"));

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("pulled");
    expect(drive.written).toHaveLength(0);
    const loaded = await store.loadData();
    expect(loaded?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  test("reports up-to-date when both sides match", async () => {
    const store = new LocalStore(memoryStorage());
    const data = makeData("2026-01-02T00:00:00.000Z");
    await store.saveData(data);
    const drive = new MockDrive();
    drive.seedRemote(data);

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("up-to-date");
    expect(drive.written).toHaveLength(0);
  });

  test("reports conflict when both sides changed since the last sync", async () => {
    const store = new LocalStore(memoryStorage());
    await store.saveData(makeData("2026-01-03T00:00:00.000Z"));
    await store.setLastSyncedAt("2026-01-01T00:00:00.000Z");
    const drive = new MockDrive();
    drive.seedRemote(makeData("2026-01-04T00:00:00.000Z"));

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("conflict");
    expect(result.localUpdatedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(result.remoteUpdatedAt).toBe("2026-01-04T00:00:00.000Z");
    expect(drive.written).toHaveLength(0);
    // Nothing was overwritten.
    expect((await store.loadData())?.updatedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  test("pulls when only the remote side is newer", async () => {
    const store = new LocalStore(memoryStorage());
    await store.saveData(makeData("2026-01-02T00:00:00.000Z"));
    await store.setLastSyncedAt("2026-01-02T00:00:00.000Z");
    const drive = new MockDrive();
    drive.seedRemote(makeData("2026-01-05T00:00:00.000Z"));

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("pulled");
    expect((await store.loadData())?.updatedAt).toBe("2026-01-05T00:00:00.000Z");
  });

  test("pushes when only the local side is newer", async () => {
    const store = new LocalStore(memoryStorage());
    await store.saveData(makeData("2026-01-06T00:00:00.000Z"));
    await store.setLastSyncedAt("2026-01-02T00:00:00.000Z");
    const drive = new MockDrive();
    drive.seedRemote(makeData("2026-01-02T00:00:00.000Z"));

    const result = await syncWithDrive(store, drive, "Memorize");

    expect(result.status).toBe("pushed");
    expect(drive.written).toHaveLength(1);
    expect(drive.written[0]?.id).toBe("remote-1");
  });

  test("forcePush and forcePull resolve either way", async () => {
    const store = new LocalStore(memoryStorage());
    await store.saveData(makeData("2026-01-03T00:00:00.000Z"));
    const drive = new MockDrive();
    drive.seedRemote(makeData("2026-01-04T00:00:00.000Z"));

    await forcePush(store, drive, "Memorize");
    const afterPush = JSON.parse(await drive.readFile("remote-1")) as AppData;
    expect(afterPush.updatedAt).toBe("2026-01-03T00:00:00.000Z");

    await store.saveData(makeData("2026-01-01T00:00:00.000Z"));
    await forcePull(store, drive, "Memorize");
    expect((await store.loadData())?.updatedAt).toBe("2026-01-03T00:00:00.000Z");
  });
});

describe("buildDrivePayload", () => {
  test("never includes the API key, even if one sneaks into settings", () => {
    const data = makeData("2026-01-02T00:00:00.000Z");
    const sneaky = {
      ...data,
      settings: { ...data.settings, gospelEngineKey: "super-secret" },
    };
    const payload = buildDrivePayload(sneaky as AppData);
    expect(payload).not.toContain("super-secret");
    expect(payload).not.toContain("gospelEngineKey");
  });
});
