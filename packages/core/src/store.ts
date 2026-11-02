import {
  createEmptyAppData,
  type AppData,
  type MemorizedVerse,
  type ReviewOutcome,
  type Verse,
} from "@memorize/types";
import { applyReview, markMemorized, nextReviewDate } from "./schedule";
import { isSameVerse } from "./scripture";
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
        if (
          entry &&
          (verse.chunkKey !== undefined ||
            verse.sourceType !== undefined ||
            verse.sourceId !== undefined) &&
          (entry.verse.chunkKey === undefined ||
            entry.verse.sourceType === undefined ||
            entry.verse.sourceId === undefined)
        ) {
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
      const now = new Date();
      const entry: MemorizedVerse = {
        verse,
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
