// Public API of @memorize/core. Named re-exports (rather than `export *`) so
// bundlers can statically analyze the CommonJS dist output.

export type {
  AppData,
  AppSettings,
  MemorizedVerse,
  ReviewOutcome,
  Verse,
  VerseStatus,
} from "@memorize/types";
export { createEmptyAppData, DATA_VERSION, DEFAULT_SETTINGS } from "@memorize/types";

export type { ScriptureDataSource } from "./scripture";
export {
  DemoDataSource,
  DEMO_VERSES,
  GospelEngineDataSource,
  mapChapterResponse,
  mapGetResponse,
  mapSearchItem,
  mapVerseDetail,
  normalizeReference,
  parseReference,
  ScriptureApiError,
} from "./scripture";

export {
  applyReview,
  dueVerses,
  markMemorized,
  nextReviewDate,
  REVIEW_INTERVALS_DAYS,
} from "./schedule";

export { BLANK_FRACTIONS, blankedIndices, gradeRound, tokenize } from "./drill";

export type { KeyValueStorage } from "./storage";
export { DATA_KEY, LocalStore, SECRETS_KEY } from "./storage";

export type { DriveClient, DriveFileMeta, SyncOptions, SyncResult, SyncStatus } from "./drive";
export {
  buildDrivePayload,
  DEFAULT_FILE_NAME,
  DriveApiError,
  forcePull,
  forcePush,
  RestDriveClient,
  syncWithDrive,
} from "./drive";

export type { MemorizeActions, MemorizeState, MemorizeStore } from "./store";
export { createMemorizeStore } from "./store";
