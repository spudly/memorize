import type { AppData, ReviewOutcome, Verse } from "@memorize/types";

export type MemorizeState = {
  data: AppData;
};

export type MemorizeActions = {
  addVerse(verse: Verse): Promise<void>;
  removeVerse(id: string): Promise<void>;
  setDrillProgress(id: string, round: number, peeks: number): Promise<void>;
  completeDrill(id: string, now?: Date): Promise<void>;
  recordReview(id: string, outcome: ReviewOutcome, now?: Date): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
};

export type MemorizeStore = {
  readonly ready: Promise<void>;
  getState(): MemorizeState;
  subscribe(listener: () => void): () => void;
  actions: MemorizeActions;
};
