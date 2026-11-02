/** A single scripture verse that can be memorized. */
export interface Verse {
  /**
   * Unique id: the normalized reference slug for scriptures, e.g.
   * `ether-12-27` (kept for scripture search hits too, so search and
   * `/api/get` agree). Non-scripture full-library search results are
   * CHUNKS of a document, and each chunk is its own memorizable item
   * (Stephen's ruling on #79, 2026-11-01), so their id is the engine
   * document identity plus a content hash of the chunk itself, e.g.
   * `talks-3161~<hash>` — never the document id alone, which every
   * chunk of the document would share: the first chunk in one
   * response and a different chunk returned alone in a later response
   * would then carry the same id and be mistaken for one item.
   * Duplicate results within one list get a further content-derived
   * suffix from `withUniqueIds` so rendered keys stay unique.
   * Membership/dedupe use `isSameVerse`, which compares the persisted
   * {@link Verse.chunkKey} first when both sides carry one.
   */
  id: string;
  /** Human-readable reference, e.g. `Ether 12:27`. */
  reference: string;
  /** Full verse text. */
  text: string;
  book?: string;
  chapter?: string;
  /**
   * The engine's document type for a full-library search result
   * (the item's `source_type`, e.g. `talks`, `scriptures`), persisted
   * at map time so a saved verse keeps its source identity (#79).
   * Absent on verses mapped from shapes that carry none (the
   * `/api/get` verse items, demo verses) and on legacy saves.
   */
  sourceType?: string;
  /**
   * The engine's document id for a full-library search result (the
   * item's `source_id`, as a string), persisted alongside
   * {@link Verse.sourceType}. A document id identifies the DOCUMENT,
   * never the chunk — see {@link Verse.chunkKey}.
   */
  sourceId?: string;
  /**
   * Stable identity of THIS memorizable item (one chunk), derived at
   * map time and persisted with the verse (#79):
   *
   * - Library chunk: `<sourceType>:<sourceId>:<textHash>` — the
   *   document identity plus a hash of the chunk's own text, so two
   *   chunks of one document are different items, and the same chunk
   *   keeps its key alone, in a subset, or reordered.
   * - Scripture passage: `scripture:<reference-slug>` — deliberately
   *   text-independent, because a search snippet and the full
   *   `/api/get` text are the same passage with different texts and
   *   must keep matching (the Ether 12:27 control).
   * - Anything else: `ref:<reference-slug>:<textHash>`.
   *
   * Absent on verses saved before this field existed; `isSameVerse`
   * bridges those legacy saves by reference + text (and, for a
   * scripture key, by reference), and the store annotates a legacy
   * entry with the verified key the first time it matches.
   */
  chunkKey?: string;
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
