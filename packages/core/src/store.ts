import {
  createEmptyAppData,
  type AppData,
  type MemorizedVerse,
  type ReviewOutcome,
  type Verse,
} from "@memorize/types";
import { applyReview, markMemorized, nextReviewDate } from "./schedule";
import { isSameVerse, suppliesMissingVerseIdentity } from "./scripture";
import { LocalStore, type KeyValueStorage } from "./storage";

export interface MemorizeState {
  data: AppData;
  apiKey: string | null;
}

export interface MemorizeActions {
  addVerse(verse: Verse): void;
  removeVerse(id: string): void;
  setDrillProgress(id: string, round: number, peeks: number): void;
  completeDrill(id: string, now?: Date): void;
  recordReview(id: string, outcome: ReviewOutcome, now?: Date): void;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
}

export interface MemorizeStore {
  readonly ready: Promise<void>;
  getState(): MemorizeState;
  subscribe(listener: () => void): () => void;
  actions: MemorizeActions;
}

/**
 * Framework-agnostic app store. Persists every mutation through LocalStore and
 * notifies subscribers. No React / React Native dependency — the apps wrap it
 * (e.g. with useSyncExternalStore or a simple subscribe -> setState bridge).
 */
export function createMemorizeStore(storage: KeyValueStorage): MemorizeStore {
  const local = new LocalStore(storage);
  let data: AppData = createEmptyAppData();
  let apiKey: string | null = null;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const persist = async (): Promise<void> => {
    data = { ...data, updatedAt: new Date().toISOString() };
    await local.saveData(data);
    emit();
  };

  const findVerse = (id: string): MemorizedVerse | undefined =>
    data.verses.find((v) => v.verse.id === id);

  const updateVerse = (id: string, update: (v: MemorizedVerse) => MemorizedVerse): void => {
    if (!findVerse(id)) {
      return;
    }
    data = {
      ...data,
      verses: data.verses.map((v) => (v.verse.id === id ? update(v) : v)),
    };
    void persist();
  };

  const ready = (async (): Promise<void> => {
    const loaded = await local.loadData();
    if (loaded) {
      data = loaded;
    }
    apiKey = await local.getApiKey();
    emit();
  })();

  const actions: MemorizeActions = {
    addVerse(verse: Verse): void {
      // Dedupe on verse identity, not id alone (see isSameVerse):
      // each chunk of a document is its own item (#79, Stephen's
      // ruling), so dedupe compares the persisted per-chunk identity
      // — a different chunk of an already-saved document is NOT a
      // duplicate and stays addable below.
      const matchIndex = data.verses.findIndex((entry) => isSameVerse(entry.verse, verse));
      if (matchIndex >= 0) {
        // Legacy reconciliation (#79): a pre-chunkKey save matched by
        // the bridge in isSameVerse has now been VERIFIED as this
        // chunk, so persist the incoming verse's source + chunk
        // identity onto the stored entry — keeping its id and all
        // progress — instead of leaving it key-less. Later results
        // then compare chunk keys directly: this same chunk keeps
        // matching, and a different chunk of the same document (a
        // changed snippet is a different chunk under the per-chunk
        // ruling) no longer needs the bridge and stays addable as
        // its own entry. Fields already on the stored verse are
        // never overwritten.
        const entry = data.verses[matchIndex];
        // Only persist when the incoming verse actually fills a field
        // the stored verse lacks: a verse that legitimately carries a
        // chunkKey without source fields (demo verses, /api/get
        // results) matches itself on re-search, and persisting that
        // no-op would advance updatedAt — which Drive sync uses to
        // detect local edits — risking a false sync conflict.
        if (entry && suppliesMissingVerseIdentity(entry.verse, verse)) {
          const annotated: Verse = { ...entry.verse };
          if (annotated.chunkKey === undefined && verse.chunkKey !== undefined) {
            annotated.chunkKey = verse.chunkKey;
          }
          if (annotated.sourceType === undefined && verse.sourceType !== undefined) {
            annotated.sourceType = verse.sourceType;
          }
          if (annotated.sourceId === undefined && verse.sourceId !== undefined) {
            annotated.sourceId = verse.sourceId;
          }
          data = {
            ...data,
            verses: data.verses.map((v, i) => (i === matchIndex ? { ...v, verse: annotated } : v)),
          };
          void persist();
        }
        return;
      }
      // The incoming verse is a distinct item (its chunk identity
      // matched no saved entry above), but its id can still collide
      // with a saved entry's id: source-less results carry the bare
      // reference-slug id, and withUniqueIds only disambiguates
      // WITHIN one response — chunk A saved from [A, B] holds
      // `charity-never-faileth` while chunk B returned alone takes
      // that same bare id despite its different chunkKey. Persist
      // the new item under an unused id instead: duplicate ids give
      // library cards duplicate React keys and make id-based
      // progress updates/removal hit both entries. Existing entries
      // keep their ids and progress untouched, and the new item's
      // chunkKey is unchanged, so identity-based membership/dedupe
      // is unaffected.
      let verseToAdd = verse;
      if (data.verses.some((entry) => entry.verse.id === verse.id)) {
        let suffix = 2;
        let candidate = `${verse.id}~${suffix}`;
        while (data.verses.some((entry) => entry.verse.id === candidate)) {
          suffix += 1;
          candidate = `${verse.id}~${suffix}`;
        }
        verseToAdd = { ...verse, id: candidate };
      }
      const now = new Date();
      const entry: MemorizedVerse = {
        verse: verseToAdd,
        status: "learning",
        addedAt: now.toISOString(),
        drillRound: 0,
        drillPeeks: 0,
        reviewsCompleted: 0,
        nextReviewAt: nextReviewDate(now, 0).toISOString(),
      };
      data = { ...data, verses: [...data.verses, entry] };
      void persist();
    },

    removeVerse(id: string): void {
      if (!findVerse(id)) {
        return;
      }
      data = { ...data, verses: data.verses.filter((v) => v.verse.id !== id) };
      void persist();
    },

    setDrillProgress(id: string, round: number, peeks: number): void {
      updateVerse(id, (v) => ({ ...v, drillRound: round, drillPeeks: peeks }));
    },

    completeDrill(id: string, now: Date = new Date()): void {
      updateVerse(id, (v) => markMemorized(v, now));
    },

    recordReview(id: string, outcome: ReviewOutcome, now: Date = new Date()): void {
      updateVerse(id, (v) => applyReview(v, outcome, now));
    },

    async setApiKey(key: string): Promise<void> {
      await local.setApiKey(key);
      apiKey = key;
      emit();
    },

    async clearApiKey(): Promise<void> {
      await local.clearApiKey();
      apiKey = null;
      emit();
    },

    async replaceAll(next: AppData): Promise<void> {
      data = next;
      await local.saveData(data);
      emit();
    },
  };

  return {
    ready,
    getState: (): MemorizeState => ({ data, apiKey }),
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions,
  };
}
