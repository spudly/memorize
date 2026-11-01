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

  test("does not re-add a pre-#79 legacy save under its new document id", async () => {
    // Saved before #79: the Allred talk under its title-slug id, with
    // drill progress. After the fix the same search result carries
    // talks-3161; adding it must not create a second learning entry.
    const storage = memoryStorage();
    const legacyStore = createMemorizeStore(storage);
    await legacyStore.ready;
    const legacy: Verse = {
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: "Plead for a desire to be filled with the gift of charity.",
    };
    legacyStore.actions.addVerse(legacy);
    legacyStore.actions.setDrillProgress(legacy.id, 2, 1);
    await flush();

    const store = createMemorizeStore(storage);
    await store.ready;
    store.actions.addVerse({ ...legacy, id: "talks-3161" });
    await flush();
    const verses = store.getState().data.verses;
    expect(verses).toHaveLength(1);
    expect(verses[0]?.verse.id).toBe("charity-never-faileth");
    expect(verses[0]?.drillRound).toBe(2);
  });

  test("still adds a distinct same-titled document alongside a legacy save", async () => {
    // The other "Charity Never Faileth" talk (Monson) shares the
    // legacy reference but not the text: it is a different document
    // and must remain addable — legacy matching is never title-only.
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse({
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: "Plead for a desire to be filled with the gift of charity.",
    });
    store.actions.addVerse({
      id: "talks-3086",
      reference: "Charity Never Faileth",
      text: "Charity is not a single act or a single virtue.",
    });
    await flush();
    expect(store.getState().data.verses).toHaveLength(2);
  });

  test("does not re-add a saved chunk when a later response renumbers it", async () => {
    // The second chunk was saved under its list-local suffix id; a
    // subset response returns that chunk alone under the canonical
    // id, and a reordered response under a different suffix. Neither
    // may create a duplicate entry.
    const chunk: Verse = {
      id: "charity-never-faileth-2",
      reference: "Charity Never Faileth",
      text: "Second chunk of the same talk.",
    };
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(chunk);
    store.actions.addVerse({ ...chunk, id: "charity-never-faileth" });
    store.actions.addVerse({ ...chunk, id: "charity-never-faileth-3" });
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
