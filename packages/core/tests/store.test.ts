import type { Verse } from "@memorize/types";
import { LocalStore, type KeyValueStorage } from "../src/storage";
import { createMemorizeStore } from "../src/store";

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

/** Flush the fire-and-forget persist() microtask chains. */
async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

const VERSE: Verse = {
  id: "john-3-16",
  reference: "John 3:16",
  text: "For God so loved the world...",
};

describe("memorize store", () => {
  test("adds a verse and persists it across store instances", async () => {
    const storage = memoryStorage();
    const store = createMemorizeStore(storage);
    await store.ready;

    store.actions.addVerse(VERSE);
    await flush();
    expect(store.getState().data.verses).toHaveLength(1);

    const store2 = createMemorizeStore(storage);
    await store2.ready;
    const entry = store2.getState().data.verses[0];
    expect(entry?.verse.id).toBe("john-3-16");
    expect(entry?.status).toBe("learning");
    expect(entry?.nextReviewAt).toBeDefined();
  });

  test("does not add the same verse twice", async () => {
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(VERSE);
    store.actions.addVerse(VERSE);
    await flush();
    expect(store.getState().data.verses).toHaveLength(1);
  });

  test("removes a verse", async () => {
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(VERSE);
    await flush();
    store.actions.removeVerse(VERSE.id);
    await flush();
    expect(store.getState().data.verses).toHaveLength(0);
  });

  test("tracks drill progress and completion", async () => {
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(VERSE);
    await flush();

    store.actions.setDrillProgress(VERSE.id, 2, 1);
    await flush();
    expect(store.getState().data.verses[0]?.drillRound).toBe(2);
    expect(store.getState().data.verses[0]?.drillPeeks).toBe(1);

    const now = new Date("2026-05-01T00:00:00.000Z");
    store.actions.completeDrill(VERSE.id, now);
    await flush();
    const entry = store.getState().data.verses[0];
    expect(entry?.status).toBe("memorized");
    expect(entry?.memorizedAt).toBe(now.toISOString());
  });

  test("records reviews and advances the schedule", async () => {
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(VERSE);
    await flush();

    const before = store.getState().data.verses[0]?.nextReviewAt;
    store.actions.recordReview(VERSE.id, "remembered", new Date("2026-06-01T00:00:00.000Z"));
    await flush();
    const after = store.getState().data.verses[0];
    expect(after?.reviewsCompleted).toBe(1);
    expect(after?.nextReviewAt).not.toBe(before);
  });

  test("stores the API key separately from synced data", async () => {
    const storage = memoryStorage();
    const store = createMemorizeStore(storage);
    await store.ready;
    await store.actions.setApiKey("secret-key");
    expect(store.getState().apiKey).toBe("secret-key");

    const store2 = createMemorizeStore(storage);
    await store2.ready;
    expect(store2.getState().apiKey).toBe("secret-key");

    const raw = await new LocalStore(storage).loadData();
    expect(JSON.stringify(raw)).not.toContain("secret-key");

    await store2.actions.clearApiKey();
    const store3 = createMemorizeStore(storage);
    await store3.ready;
    expect(store3.getState().apiKey).toBeNull();
  });

  test("replaceAll swaps in synced data and notifies subscribers", async () => {
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    let notifications = 0;
    const unsub = store.subscribe(() => {
      notifications += 1;
    });

    const next = store.getState().data;
    await store.actions.replaceAll({ ...next, verses: [] });
    expect(store.getState().data.verses).toHaveLength(0);
    expect(notifications).toBeGreaterThan(0);
    unsub();
  });
});
