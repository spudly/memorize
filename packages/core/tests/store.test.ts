import type { Verse } from "@memorize/types";
import { mapSearchItem } from "../src/scripture";
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

  test("keeps an unsaved chunk addable when reordered results renumber ids", async () => {
    // Copilot's reorder case: chunk B saved from [A, B]; a reordered
    // [B, A] response must not make the unsaved chunk A look saved
    // (or reject its add), and re-adding B from that response must
    // not duplicate it. Chunk ids here use the content-derived
    // suffix form withUniqueIds emits.
    const chunkA: Verse = {
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: "First chunk of the same talk.",
    };
    const chunkB: Verse = {
      id: "charity-never-faileth~abc123",
      reference: "Charity Never Faileth",
      text: "Second chunk of the same talk.",
    };
    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(chunkB);
    // Reordered response: B arrives under the canonical id, A under
    // a content suffix — neither id equals B's saved id positionally.
    store.actions.addVerse({ ...chunkB, id: "charity-never-faileth" });
    store.actions.addVerse({ ...chunkA, id: "charity-never-faileth~def456" });
    await flush();
    const verses = store.getState().data.verses;
    expect(verses).toHaveLength(2);
    expect(verses.map((v) => v.verse.text)).toContain(chunkA.text);
  });

  test("(a) holds both chunks of one document, including one first seen alone", async () => {
    // [A, B] of talks-3161 are mapped, A is saved; B is then mapped
    // from a later response returning B alone. B must keep its own
    // chunk identity and be addable alongside A — under the old
    // document-id scheme B-alone took the bare `talks-3161` id that
    // A held in [A, B], and the add was refused as a duplicate.
    const chunkAItem = {
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet: "First chunk of the Allred talk.",
    };
    const chunkBItem = {
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet: "Second chunk of the Allred talk.",
    };
    const chunkA = mapSearchItem(chunkAItem);
    const chunkBAlone = mapSearchItem(chunkBItem);
    expect(chunkA).not.toBeNull();
    expect(chunkBAlone).not.toBeNull();
    if (!chunkA || !chunkBAlone) return;

    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(chunkA);
    store.actions.addVerse(chunkBAlone);
    await flush();
    expect(store.getState().data.verses).toHaveLength(2);
    // Re-adding either chunk (freshly mapped, same identity) dedupes.
    const chunkAAgain = mapSearchItem(chunkAItem);
    const chunkBAgain = mapSearchItem(chunkBItem);
    if (chunkAAgain) store.actions.addVerse(chunkAAgain);
    if (chunkBAgain) store.actions.addVerse(chunkBAgain);
    await flush();
    expect(store.getState().data.verses).toHaveLength(2);
  });

  test("allocates an unused id when a distinct source-less chunk arrives alone under a saved chunk's id", async () => {
    // Copilot's cross-response case: source-less chunks carry the
    // bare reference-slug id. Chunk A is saved from a combined
    // [A, B] response (the first occurrence keeps the bare id);
    // chunk B later returns ALONE and takes that same bare id, but
    // its chunkKey differs, so it is a distinct item and must be
    // inserted under an unused id — a second entry with A's id
    // would duplicate React keys in the library and make id-based
    // progress updates/removal hit both entries.
    const chunkA = mapSearchItem({
      title: "Charity Never Faileth",
      snippet: "First source-less chunk.",
    });
    const chunkBAlone = mapSearchItem({
      title: "Charity Never Faileth",
      snippet: "Second source-less chunk.",
    });
    expect(chunkA).not.toBeNull();
    expect(chunkBAlone).not.toBeNull();
    if (!chunkA || !chunkBAlone) return;
    expect(chunkA.id).toBe("charity-never-faileth");
    expect(chunkBAlone.id).toBe("charity-never-faileth");
    expect(chunkA.chunkKey).not.toBe(chunkBAlone.chunkKey);

    const store = createMemorizeStore(memoryStorage());
    await store.ready;
    store.actions.addVerse(chunkA);
    store.actions.addVerse(chunkBAlone);
    await flush();
    const verses = store.getState().data.verses;
    expect(verses).toHaveLength(2);
    expect(new Set(verses.map((v) => v.verse.id)).size).toBe(2);
    // The existing entry keeps its id; the new entry got a fresh one.
    expect(verses[0]?.verse.id).toBe("charity-never-faileth");
    const chunkBId = verses[1]?.verse.id;
    expect(chunkBId).toBeDefined();
    if (!chunkBId) return;

    // Progress by id touches only its own entry.
    store.actions.setDrillProgress(chunkBId, 3, 1);
    await flush();
    expect(store.getState().data.verses[0]?.drillRound).toBe(0);
    expect(store.getState().data.verses[1]?.drillRound).toBe(3);

    // Re-adding chunk B dedupes by chunkKey despite the allocated id.
    store.actions.addVerse(chunkBAlone);
    await flush();
    expect(store.getState().data.verses).toHaveLength(2);

    // Removal by id removes only chunk B.
    store.actions.removeVerse(chunkBId);
    await flush();
    const remaining = store.getState().data.verses;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.verse.text).toBe(chunkA.text);
  });

  test("annotates a legacy save with the verified chunk identity on match, preserving progress", async () => {
    // Copilot's legacy case, under the per-chunk ruling: a key-less
    // legacy save matches chunk B by reference + text, so B's source
    // + chunk identity is persisted onto the stored entry (id and
    // drill progress untouched). A later DIFFERENT chunk of the same
    // document is then a different item by chunk key — it must be
    // addable as its own entry, not swallowed by the document id.
    const storage = memoryStorage();
    const legacyStore = createMemorizeStore(storage);
    await legacyStore.ready;
    const legacy: Verse = {
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: "Second chunk of the Allred talk.",
    };
    legacyStore.actions.addVerse(legacy);
    legacyStore.actions.setDrillProgress(legacy.id, 2, 1);
    await flush();

    const chunkB = mapSearchItem({
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet: "Second chunk of the Allred talk.",
    });
    const chunkA = mapSearchItem({
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet: "First chunk of the Allred talk.",
    });
    expect(chunkB).not.toBeNull();
    expect(chunkA).not.toBeNull();
    if (!chunkA || !chunkB) return;

    const store = createMemorizeStore(storage);
    await store.ready;
    store.actions.addVerse(chunkB);
    await flush();
    let verses = store.getState().data.verses;
    expect(verses).toHaveLength(1);
    expect(verses[0]?.verse.id).toBe("charity-never-faileth");
    expect(verses[0]?.drillRound).toBe(2);
    expect(verses[0]?.verse.chunkKey).toBe(chunkB.chunkKey);
    expect(verses[0]?.verse.sourceType).toBe("talks");
    expect(verses[0]?.verse.sourceId).toBe("3161");

    // The annotation survived a reload (it was persisted, not just
    // held in memory), and the other chunk now adds as its own item.
    const store2 = createMemorizeStore(storage);
    await store2.ready;
    expect(store2.getState().data.verses[0]?.verse.chunkKey).toBe(chunkB.chunkKey);
    store2.actions.addVerse(chunkA);
    await flush();
    verses = store2.getState().data.verses;
    expect(verses).toHaveLength(2);
    expect(verses.map((v) => v.verse.text)).toContain(chunkA.text);
  });

  test("(d) a legacy verse without the new fields still loads and matches by reference + text", async () => {
    const storage = memoryStorage();
    const legacyStore = createMemorizeStore(storage);
    await legacyStore.ready;
    legacyStore.actions.addVerse({
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: "Plead for a desire to be filled with the gift of charity.",
    });
    await flush();

    const store = createMemorizeStore(storage);
    await store.ready;
    const loaded = store.getState().data.verses[0]?.verse;
    expect(loaded?.chunkKey).toBeUndefined();
    expect(loaded?.sourceId).toBeUndefined();
    const incoming = mapSearchItem({
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet: "Plead for a desire to be filled with the gift of charity.",
    });
    expect(incoming).not.toBeNull();
    if (!incoming) return;
    store.actions.addVerse(incoming);
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
