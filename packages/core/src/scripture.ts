import type { Verse } from "@memorize/types";

/** Abstraction over wherever verse text comes from. */
export interface ScriptureDataSource {
  search(query: string): Promise<Verse[]>;
  getVerse(reference: string): Promise<Verse>;
}

export class ScriptureApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ScriptureApiError";
    this.status = status;
  }
}

/** "Ether  12:27" -> "ether-12-27". Used as the stable verse id. */
export function normalizeReference(ref: string): string {
  const collapsed = ref.trim().replace(/\s+/g, " ");
  return collapsed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

const BOOK_ALIASES: Record<string, string> = {
  "d&c": "Doctrine and Covenants",
  "doctrine & covenants": "Doctrine and Covenants",
};

/**
 * If `query` is shaped like a scripture reference — a book name followed by
 * a chapter, with an optional verse or verse range ("Ether 12:27",
 * "1 Nephi 3:7", "Proverbs 3:5-6", "Alma 32", "D&C 18:10") — return the
 * canonical reference to look up. Otherwise return null: the query is a
 * keyword/topic search. Detection is structural (trailing chapter[:verse]
 * numbers after book text), so a miss costs one /api/get round-trip and
 * the caller falls back to semantic search.
 */
export function parseReference(query: string): string | null {
  const collapsed = query.trim().replace(/\s+/g, " ");
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/.exec(collapsed);
  if (!match) {
    return null;
  }
  const [, rawBook, chapter, verse, endVerse] = match;
  if (rawBook === undefined || chapter === undefined) {
    return null;
  }
  const bookRaw = rawBook.trim();
  // The book part must contain a letter and no colon — this rejects bare
  // numbers and times ("12:27") that the regex could otherwise force-fit.
  if (!/[a-zA-Z]/.test(bookRaw) || bookRaw.includes(":")) {
    return null;
  }
  const book = BOOK_ALIASES[bookRaw.toLowerCase().replace(/\.$/, "")] ?? bookRaw;
  let reference = `${book} ${chapter}`;
  if (verse !== undefined) {
    reference += `:${verse}`;
    if (endVerse !== undefined) {
      reference += `-${endVerse}`;
    }
  }
  return reference;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function buildVerse(reference: string, text: string, obj: Record<string, unknown>): Verse {
  const verse: Verse = { id: normalizeReference(reference), reference, text };
  const book = firstString(obj, ["book", "book_name"]);
  if (book !== undefined) {
    verse.book = book;
  }
  // The verified /api/get shape carries chapter as a JSON number.
  const chapterRaw = obj["chapter"] ?? obj["chapter_number"];
  if (typeof chapterRaw === "string" && chapterRaw.trim().length > 0) {
    verse.chapter = chapterRaw.trim();
  } else if (typeof chapterRaw === "number") {
    verse.chapter = String(chapterRaw);
  }
  return verse;
}

/**
 * Map one raw search-result item to a Verse.
 *
 * The gospel-engine response shape is UNVERIFIED (the API requires a key we
 * don't have yet), so this tries the most likely field names and returns null
 * when nothing matches. See docs/api-notes.md.
 */
export function mapSearchItem(raw: unknown): Verse | null {
  const obj = asRecord(raw);
  if (!obj) {
    return null;
  }
  const reference = firstString(obj, ["reference", "ref", "citation", "title"]);
  const text = firstString(obj, ["text", "verse_text", "content", "body", "snippet"]);
  if (reference === undefined || text === undefined) {
    return null;
  }
  return buildVerse(reference, text, obj);
}

/** Map a raw single-verse response, tolerating a nested envelope. */
export function mapVerseDetail(raw: unknown): Verse | null {
  const obj = asRecord(raw);
  if (!obj) {
    return null;
  }
  for (const key of ["verse", "result", "data", "item"]) {
    const nested = obj[key];
    if (nested !== undefined) {
      const mapped = mapSearchItem(nested);
      if (mapped) {
        return mapped;
      }
    }
  }
  return mapSearchItem(obj);
}

function resultItems(data: unknown): unknown[] | null {
  if (Array.isArray(data)) {
    return data;
  }
  const obj = asRecord(data);
  if (!obj) {
    return null;
  }
  for (const key of ["results", "items", "verses", "data"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Map the chapter-only /api/get envelope to a single Verse holding the
 * whole chapter. Verified against upstream gospel-engine
 * `internal/api/server.go` getChapter (2026-10-16): a chapter-only
 * reference returns `{ source_type: "chapters", reference_query,
 * chapter: { id, volume, book, chapter, title, full_content, file_path } }`
 * — no `verses` array. `full_content` is the chapter's full text, whose
 * internal verse formatting is unverified, so it is kept whole rather
 * than split into fabricated per-verse entries. Without this, chapter
 * queries such as "Alma 32" mapped to [] and fell back to semantic
 * search despite the exact lookup succeeding.
 */
export function mapChapterResponse(data: unknown): Verse | null {
  const obj = asRecord(data);
  if (!obj) {
    return null;
  }
  const chapter = asRecord(obj["chapter"]);
  if (!chapter) {
    return null;
  }
  const text = firstString(chapter, ["full_content", "content", "text"]);
  if (text === undefined) {
    return null;
  }
  const reference =
    firstString(obj, ["reference_query", "reference", "ref"]) ??
    firstString(chapter, ["title", "reference", "ref"]);
  if (reference === undefined) {
    return null;
  }
  return buildVerse(reference, text, chapter);
}

/**
 * Map a /api/get response to verses. The verified shapes (2026-10-16) are
 * `{ reference_query, source_type, verses: [...] }` — one item per verse,
 * so a verse or range yields several — and, for a chapter-only reference,
 * the `chapters` envelope handled by mapChapterResponse. A single-object
 * payload is also tolerated via mapVerseDetail.
 */
export function mapGetResponse(data: unknown): Verse[] {
  const items = resultItems(data);
  if (items) {
    return items.map(mapSearchItem).filter((v): v is Verse => v !== null);
  }
  const chapter = mapChapterResponse(data);
  if (chapter) {
    return [chapter];
  }
  const single = mapVerseDetail(data);
  return single ? [single] : [];
}

/**
 * Live data source backed by the community gospel-engine API
 * (https://github.com/cpuchip/gospel-engine).
 *
 * No official Church API exists; this is a third-party service. Works with the
 * hosted instance at https://engine.ibeco.me or a self-hosted one.
 */
export class GospelEngineDataSource implements ScriptureDataSource {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private authHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async search(query: string): Promise<Verse[]> {
    // Reference-shaped queries ("Ether 12:27") go to /api/get first:
    // /api/search is semantic search over the whole library (talks,
    // manuals, study aids included) and buries the exact verse in
    // loosely related results. On any miss — no match, lookup error —
    // fall back to semantic search so nothing that worked before breaks.
    const reference = parseReference(query);
    if (reference !== null) {
      try {
        const verses = await this.lookupReference(reference);
        if (verses.length > 0) {
          return verses;
        }
      } catch {
        // Fall through to semantic search.
      }
    }
    const url = `${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders() });
    } catch (error) {
      throw new ScriptureApiError(
        `Could not reach the scripture service: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (!res.ok) {
      throw new ScriptureApiError(`Scripture search failed with status ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    const items = resultItems(data);
    if (!items) {
      throw new ScriptureApiError(
        "Unexpected search response shape. See packages/core/docs/api-notes.md to verify the field mapping.",
      );
    }
    return items.map(mapSearchItem).filter((v): v is Verse => v !== null);
  }

  /**
   * Exact lookup via /api/get. Returns one Verse per verse in the
   * reference (a range or chapter returns several). A 404 means "no such
   * reference" and returns []; other failures throw ScriptureApiError.
   * Note the parameter is `ref` — verified against the live API
   * 2026-10-16 (see docs/api-notes.md).
   */
  async lookupReference(reference: string): Promise<Verse[]> {
    const url = `${this.baseUrl}/api/get?ref=${encodeURIComponent(reference)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders() });
    } catch (error) {
      throw new ScriptureApiError(
        `Could not reach the scripture service: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      throw new ScriptureApiError(`Scripture lookup failed with status ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    return mapGetResponse(data);
  }

  async getVerse(reference: string): Promise<Verse> {
    const verses = await this.lookupReference(reference);
    const verse = verses[0];
    if (!verse) {
      throw new ScriptureApiError(`Verse not found: ${reference}`, 404);
    }
    return verse;
  }
}

const DEMO_VERSE_TUPLES: [string, string][] = [
  [
    "John 3:16",
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  ],
  [
    "Ether 12:27",
    "And if men come unto me I will show unto them their weakness. I give unto men weakness that they may be humble; and my grace is sufficient for all men that humble themselves before me; for if they humble themselves before me, and have faith in me, then will I make weak things become strong unto them.",
  ],
  ["2 Nephi 2:25", "Adam fell that men might be; and men are, that they might have joy."],
  [
    "Mosiah 2:17",
    "And behold, I tell you these things that ye may learn wisdom; that ye may learn that when ye are in the service of your fellow beings ye are only in the service of your God.",
  ],
  [
    "Alma 37:35",
    "O, remember, my son, and learn wisdom in thy youth; yea, learn in thy youth to keep the commandments of God.",
  ],
  [
    "Proverbs 3:5-6",
    "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
  ],
  ["Philippians 4:13", "I can do all things through Christ which strengtheneth me."],
  [
    "Joshua 1:8",
    "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.",
  ],
  [
    "1 Nephi 3:7",
    "And it came to pass that I, Nephi, said unto my father: I will go and do the things which the Lord hath commanded, for I know that the Lord giveth no commandments unto the children of men, save he shall prepare a way for them that they may accomplish the thing which he commandeth them.",
  ],
  ["Doctrine and Covenants 18:10", "Remember the worth of souls is great in the sight of God;"],
];

export const DEMO_VERSES: Verse[] = DEMO_VERSE_TUPLES.map(([reference, text]) => ({
  id: normalizeReference(reference),
  reference,
  text,
}));

/**
 * Offline data source with a small set of well-known verses. Used when no
 * gospel-engine API key is configured, so the app is fully usable offline.
 */
export class DemoDataSource implements ScriptureDataSource {
  async search(query: string): Promise<Verse[]> {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return [];
    }
    // Same reference-first behavior as the live source: an exact
    // reference returns just that verse, not every verse containing
    // the query as a substring.
    const reference = parseReference(query);
    if (reference !== null) {
      const exact = DEMO_VERSES.find((v) => v.id === normalizeReference(reference));
      if (exact) {
        return [exact];
      }
    }
    return DEMO_VERSES.filter((v) => `${v.reference} ${v.text}`.toLowerCase().includes(q));
  }

  async getVerse(reference: string): Promise<Verse> {
    const id = normalizeReference(reference);
    const verse = DEMO_VERSES.find((v) => v.id === id);
    if (!verse) {
      throw new ScriptureApiError(`Verse not found in demo data: ${reference}`, 404);
    }
    return verse;
  }
}
