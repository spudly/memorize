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
      // Dedupe on verse identity, not id alone: a result whose id
      // changed across the #79 fix (legacy title-slug -> document id)
      // or whose list-local suffix differs from the saved copy's
      // (see isSameVerse) is the same item, and re-adding it must not
      // create a second learning entry with separate progress.
      if (data.verses.some((entry) => isSameVerse(entry.verse, verse))) {
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
