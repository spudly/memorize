/** A single scripture verse that can be memorized. */
export interface Verse {
  /**
   * Unique id: the normalized reference slug for scriptures, e.g.
   * `ether-12-27` (kept for scripture search hits too, so search and
   * `/api/get` agree); non-scripture full-library search results
   * instead carry their engine document identity, e.g. `talks-3161`,
   * because titles repeat across documents (#79). Duplicate results
   * within one list get a list-local `-2`/`-3` suffix so rendered
   * keys stay unique; that suffix is not a stable saved identity —
   * membership/dedupe use `isSameVerse` (id, or reference + text).
   */
  id: string;
  /** Human-readable reference, e.g. `Ether 12:27`. */
  reference: string;
  /** Full verse text. */
  text: string;
  book?: string;
  chapter?: string;
}

export type VerseStatus = "learning" | "memorized";

/** A verse on the user's list, with drill + review progress. */
export interface MemorizedVerse {
  verse: Verse;
  status: VerseStatus;
  /** ISO-8601 timestamp of when the verse was added. */
  addedAt: string;
  /** ISO-8601 timestamp of when the drill was completed. */
  memorizedAt?: string;
  /** Current progressive-blanking round (0-based). */
  drillRound: number;
  /** Peeks used in the current drill round. */
  drillPeeks: number;
  /** Successful reviews completed since the last reset. */
  reviewsCompleted: number;
  /** ISO-8601 timestamp of the last review. */
  lastReviewedAt?: string;
  /** ISO-8601 timestamp of when the next review is due. */
  nextReviewAt?: string;
}

/**
 * App settings. `gospelEngineKey` is LOCAL-ONLY: it lives in secret storage on
 * the device and is never included in the data synced to Google Drive.
 */
export interface AppSettings {
  gospelEngineKey?: string;
  gospelEngineBaseUrl: string;
  driveFolderName: string;
}

/**
 * Everything that gets synced to Google Drive. The API key is deliberately
 * excluded — see {@link AppSettings.gospelEngineKey}.
 */
export interface AppData {
  version: 1;
  verses: MemorizedVerse[];
  settings: Omit<AppSettings, "gospelEngineKey">;
  /** ISO-8601 timestamp of the last local mutation; drives sync conflict logic. */
  updatedAt: string;
}

export type ReviewOutcome = "remembered" | "forgot";

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: Omit<AppSettings, "gospelEngineKey"> = {
  gospelEngineBaseUrl: "https://engine.ibeco.me",
  driveFolderName: "Memorize",
};

export function createEmptyAppData(): AppData {
  return {
    version: DATA_VERSION,
    verses: [],
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: new Date().toISOString(),
  };
}
