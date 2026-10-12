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
  const chapter = firstString(obj, ["chapter", "chapter_number"]);
  if (chapter !== undefined) {
    verse.chapter = chapter;
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

  async getVerse(reference: string): Promise<Verse> {
    const url = `${this.baseUrl}/api/get?reference=${encodeURIComponent(reference)}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeaders() });
    } catch (error) {
      throw new ScriptureApiError(
        `Could not reach the scripture service: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (!res.ok) {
      throw new ScriptureApiError(`Scripture lookup failed with status ${res.status}`, res.status);
    }
    const data: unknown = await res.json();
    const verse = mapVerseDetail(data);
    if (!verse) {
      throw new ScriptureApiError(
        "Unexpected verse response shape. See packages/core/docs/api-notes.md to verify the field mapping.",
      );
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
