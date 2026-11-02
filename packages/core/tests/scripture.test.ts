import {
  DemoDataSource,
  GospelEngineDataSource,
  isSameVerse,
  mapChapterResponse,
  mapGetResponse,
  mapSearchItem,
  parseReference,
  ScriptureApiError,
  suppliesMissingVerseIdentity,
} from "../src/scripture";

/**
 * Verbatim /api/get response captured from the live API on 2026-10-16
 * (GET /api/get?ref=Ether+12:27-28). Note the missing-space artifacts in
 * the text ("willshow", "showunto") — they are in the upstream data.
 */
const SAMPLE_GET_RESPONSE = {
  reference_query: "Ether 12:27-28",
  source_type: "scriptures",
  verses: [
    {
      id: 4360,
      volume: "bofm",
      book: "ether",
      chapter: 12,
      verse: 27,
      reference: "Ether 12:27",
      text: "And if men come unto me I willshow unto them their weakness. I give unto men weakness that they may be humble; and my grace is sufficient for all men that humble themselves before me; for if they humble themselves before me, and havefaith in me, then will I make weak things become strong unto them.",
      file_path: "/data/gospel-library/eng/scriptures/bofm/ether/12.md",
    },
    {
      id: 4361,
      volume: "bofm",
      book: "ether",
      chapter: 12,
      verse: 28,
      reference: "Ether 12:28",
      text: "Behold, I will show unto the Gentiles their weakness, and I will showunto them that faith, hope and charity bringeth unto me—the fountain of all righteousness.",
      file_path: "/data/gospel-library/eng/scriptures/bofm/ether/12.md",
    },
  ],
};

/**
 * Chapter-only /api/get envelope, shape verified against upstream
 * gospel-engine internal/api/server.go getChapter on 2026-10-16:
 * `{ source_type: "chapters", reference_query, chapter: { id, volume,
 * book, chapter, title, full_content, file_path } }`. The full_content
 * text here is a short synthetic stand-in, not a captured chapter.
 */
const SAMPLE_CHAPTER_RESPONSE = {
  reference_query: "Alma 32",
  source_type: "chapters",
  chapter: {
    id: 901,
    volume: "bofm",
    book: "alma",
    chapter: 32,
    title: "Alma 32",
    full_content: "Chapter text stand-in for Alma 32.",
    file_path: "/data/gospel-library/eng/scriptures/bofm/alma/32.md",
  },
};

const SAMPLE_SEARCH_RESPONSE = {
  results: [{ reference: "Moroni 7:47", text: "But charity is the pure love of Christ." }],
};

interface StubResult {
  ok: boolean;
  status: number;
  body: unknown;
}

const realFetch = globalThis.fetch;

/** Replace global fetch with a recorder; returns the requested URLs. */
function stubFetch(handler: (url: string) => StubResult): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const r = handler(url);
    return { ok: r.ok, status: r.status, json: async () => r.body } as Response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("parseReference", () => {
  it.each([
    ["Ether 12:27", "Ether 12:27"],
    ["Ether 12:27-28", "Ether 12:27-28"],
    ["1 Nephi 3:7", "1 Nephi 3:7"],
    ["2 Nephi 2:25", "2 Nephi 2:25"],
    ["Proverbs 3:5-6", "Proverbs 3:5-6"],
    ["Alma 32", "Alma 32"],
    ["D&C 18:10", "Doctrine and Covenants 18:10"],
    ["  Ether   12:27 ", "Ether 12:27"],
  ])("parses %j as %j", (input, expected) => {
    expect(parseReference(input)).toBe(expected);
  });

  it.each([["charity"], ["faith in Christ"], ["12:27"], [""], ["Ether"], ["the word of wisdom"]])(
    "rejects %j",
    (input) => {
      expect(parseReference(input)).toBeNull();
    },
  );
});

describe("mapGetResponse", () => {
  it("maps the verified verses-array shape, one Verse per verse", () => {
    const verses = mapGetResponse(SAMPLE_GET_RESPONSE);
    expect(verses).toHaveLength(2);
    expect(verses[0]).toMatchObject({
      id: "ether-12-27",
      reference: "Ether 12:27",
      book: "ether",
      chapter: "12",
    });
    expect(verses[0]?.text).toContain("weak things become strong");
    expect(verses[1]?.reference).toBe("Ether 12:28");
  });

  it("maps the chapter-only envelope to one chapter Verse", () => {
    const verses = mapGetResponse(SAMPLE_CHAPTER_RESPONSE);
    expect(verses).toHaveLength(1);
    expect(verses[0]).toMatchObject({
      reference: "Alma 32",
      book: "alma",
      chapter: "32",
      text: "Chapter text stand-in for Alma 32.",
    });
    // The envelope's identity (source_type "chapters" + chapter.id as
    // source_id) is persisted like any other library document's, so
    // the Verse id is chunk-scoped and its chunk key is
    // `chapters:<id>:<textHash>` — not a source-less `ref:` key.
    expect(verses[0]?.id).toMatch(/^chapters-901~[a-z0-9]+$/);
    expect(verses[0]).toMatchObject({ sourceType: "chapters", sourceId: "901" });
    expect(verses[0]?.chunkKey).toMatch(/^chapters:901:[a-z0-9]+$/);
  });

  it("gives a chapter Verse the same chunk identity as its /api/search representation", () => {
    const chapterVerse = mapChapterResponse(SAMPLE_CHAPTER_RESPONSE);
    const searchVerse = mapSearchItem({
      source_type: "chapters",
      source_id: 901,
      title: "Alma 32",
      snippet: "Chapter text stand-in for Alma 32.",
    });
    expect(chapterVerse).not.toBeNull();
    expect(searchVerse).not.toBeNull();
    if (!chapterVerse || !searchVerse) return;
    expect(chapterVerse.chunkKey).toBe(searchVerse.chunkKey);
    expect(isSameVerse(chapterVerse, searchVerse)).toBe(true);
  });

  it("tolerates a single-object payload", () => {
    const verses = mapGetResponse({ reference: "John 3:16", text: "For God so loved the world." });
    expect(verses).toHaveLength(1);
    expect(verses[0]?.reference).toBe("John 3:16");
  });

  it("returns [] for unmappable payloads", () => {
    expect(mapGetResponse({ nope: true })).toEqual([]);
    expect(mapGetResponse(null)).toEqual([]);
  });
});

describe("GospelEngineDataSource", () => {
  const source = () => new GospelEngineDataSource("https://engine.example", "stdy_test");

  it("routes reference queries to /api/get with the ref parameter", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: true, status: 200, body: SAMPLE_GET_RESPONSE }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Ether 12:27-28");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get?ref=Ether%2012%3A27-28");
    expect(results.map((v) => v.reference)).toEqual(["Ether 12:27", "Ether 12:28"]);
  });

  it("routes chapter-only queries to /api/get and uses the chapter envelope (no search fallback)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: true, status: 200, body: SAMPLE_CHAPTER_RESPONSE }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Alma 32");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get?ref=Alma%2032");
    expect(results).toHaveLength(1);
    expect(results[0]?.reference).toBe("Alma 32");
  });

  it("routes keyword queries to /api/search only", async () => {
    const calls = stubFetch(() => ({ ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE }));
    const results = await source().search("charity");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/search?q=charity");
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("returns no results when a reference-shaped query finds nothing (404) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Hezekiah 99:99");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("returns no results when /api/get rejects the reference (400) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 400, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Hezekiah 99:99");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("falls back to /api/search for a chapter-only reference-shaped keyword query (404)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("general conference 2024");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/search");
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("falls back to /api/search for a chapter-only reference-shaped keyword query (400)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 400, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("general conference 2024");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/search");
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("returns no results for a chapter-only miss on a real book (404) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Ether 16");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("returns no results for a chapter-only miss on a real book (400) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 400, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Ether 16");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("falls back to /api/search for a chapter-only keyword query naming no known book (404)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("lesson 3");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/search");
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("falls back to /api/search for a chapter-only keyword query naming no known book (400)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 400, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("lesson 3");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/api/search");
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("returns no results for a chapter-only miss under a spoken-ordinal book name (404) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("First Nephi 99");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("returns no results for a chapter-only miss under an ordinal-suffix book name (404) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 404, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("1st Nephi 99");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("returns no results for a chapter-only miss under a hyphenated book name (400) (#70)", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 400, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Joseph Smith-History 99");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/get");
    expect(results).toEqual([]);
  });

  it("falls back to /api/search when /api/get errors", async () => {
    const calls = stubFetch((url) =>
      url.includes("/api/get")
        ? { ok: false, status: 500, body: {} }
        : { ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE },
    );
    const results = await source().search("Ether 12:27");
    expect(calls).toHaveLength(2);
    expect(results[0]?.reference).toBe("Moroni 7:47");
  });

  it("getVerse returns the first verse of the lookup", async () => {
    const calls = stubFetch(() => ({ ok: true, status: 200, body: SAMPLE_GET_RESPONSE }));
    const verse = await source().getVerse("Ether 12:27");
    expect(calls[0]).toContain("/api/get?ref=Ether%2012%3A27");
    expect(verse.reference).toBe("Ether 12:27");
  });

  it("getVerse throws a 404 ScriptureApiError when the reference is unknown", async () => {
    stubFetch(() => ({ ok: false, status: 404, body: {} }));
    await expect(source().getVerse("Ether 99:99")).rejects.toBeInstanceOf(ScriptureApiError);
  });
});

/**
 * Live /api/search shape, captured from the production proxy
 * (memorize-ivory.vercel.app/api/search?q=charity) on 2026-11-01:
 * items carry `title` + `snippet` (no `reference`/`text`) and a unique
 * `source_type` + `source_id` document identity. Two DIFFERENT talks
 * in the real result set share the title "Charity Never Faileth" —
 * the exact pair behind #79's stale card.
 */
const SAMPLE_LIVE_SEARCH_RESPONSE = {
  mode: "hybrid",
  query: "charity",
  results: [
    {
      source_type: "talks",
      source_id: 3161,
      title: "Charity Never Faileth",
      snippet:
        "First Counselor in the Relief Society General Presidency\n\nPlead for a desire to be filled with the gift of charity.",
      speaker: "Silvia H. Allred",
      year: 2011,
    },
    {
      source_type: "talks",
      source_id: 3086,
      title: "Charity Never Faileth",
      snippet: "President of the Church\n\nCharity is not a single act or a single virtue.",
      speaker: "Thomas S. Monson",
      year: 2010,
    },
    {
      source_type: "study_aids",
      source_id: 2824,
      title: "Charity",
      snippet: "Charity is the pure love of Christ.",
    },
  ],
};

describe("full-library search result identity (#79)", () => {
  const source = () => new GospelEngineDataSource("https://engine.example", "stdy_test");

  it("gives same-titled results distinct ids from their source identity", async () => {
    stubFetch(() => ({ ok: true, status: 200, body: SAMPLE_LIVE_SEARCH_RESPONSE }));
    const results = await source().search("charity");
    expect(results).toHaveLength(3);
    expect(results.map((v) => v.reference)).toEqual([
      "Charity Never Faileth",
      "Charity Never Faileth",
      "Charity",
    ]);
    const ids = results.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Ids are chunk-scoped: document identity + the chunk's own text
    // hash, never the bare document id (#79 per-chunk ruling).
    expect(ids[0]).toMatch(/^talks-3161~[a-z0-9]+$/);
    expect(ids[1]).toMatch(/^talks-3086~[a-z0-9]+$/);
    expect(ids[2]).toMatch(/^study-aids-2824~[a-z0-9]+$/);
    // The source identity and per-chunk key are persisted on the Verse.
    expect(results[0]).toMatchObject({ sourceType: "talks", sourceId: "3161" });
    expect(results[0]?.chunkKey).toMatch(/^talks:3161:[a-z0-9]+$/);
    expect(results[1]?.chunkKey).toMatch(/^talks:3086:[a-z0-9]+$/);
    expect(results[0]?.chunkKey).not.toBe(results[1]?.chunkKey);
  });

  it("keeps every result when the engine repeats one reference (chunk shape)", async () => {
    stubFetch(() => ({
      ok: true,
      status: 200,
      body: {
        results: [
          { reference: "Charity Never Faileth", text: "First chunk of the talk." },
          { reference: "Charity Never Faileth", text: "Second chunk of the same talk." },
          { reference: "Charity Never Faileth", text: "Third chunk of the same talk." },
        ],
      },
    }));
    const results = await source().search("charity");
    expect(results).toHaveLength(3);
    const ids = results.map((v) => v.id);
    // Duplicate ids are duplicate React keys in the result list — the
    // stale-card defect. The first keeps the canonical id; repeats get
    // content-derived suffixes, never dropped and never duplicated.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("charity-never-faileth");
    expect(ids[1]).toMatch(/^charity-never-faileth~[a-z0-9]+$/);
    expect(ids[2]).toMatch(/^charity-never-faileth~[a-z0-9]+$/);
  });

  it("gives a repeated-reference chunk the same id when results are reordered", async () => {
    // Positional suffixes fail this: in [A, B] chunk B is `…-2`, in
    // [B, A] chunk A is — so a saved B made the unsaved A look Added
    // and un-addable. Content-derived suffixes keep each chunk's id
    // attached to the chunk itself. (The first chunk in any list
    // keeps the canonical id, so the comparison runs with a leading
    // chunk C in both lists, making A and B repeats in both.)
    const chunkC = { reference: "Charity Never Faileth", text: "Leading chunk of the talk." };
    const chunkA = { reference: "Charity Never Faileth", text: "First chunk of the talk." };
    const chunkB = { reference: "Charity Never Faileth", text: "Second chunk of the same talk." };
    stubFetch(() => ({ ok: true, status: 200, body: { results: [chunkC, chunkA, chunkB] } }));
    const first = await source().search("charity");
    stubFetch(() => ({ ok: true, status: 200, body: { results: [chunkC, chunkB, chunkA] } }));
    const reordered = await source().search("charity");
    const idOf = (list: typeof first, text: string) => list.find((v) => v.text === text)?.id;
    expect(idOf(reordered, chunkA.text)).toBe(idOf(first, chunkA.text));
    expect(idOf(reordered, chunkB.text)).toBe(idOf(first, chunkB.text));
    expect(idOf(reordered, chunkA.text)).not.toBe(idOf(first, chunkB.text));
    expect(new Set(reordered.map((v) => v.id)).size).toBe(3);
  });

  it("suffixes duplicate references in a /api/get verses array the same way", () => {
    const verses = mapGetResponse({
      verses: [
        { reference: "Ether 12:27", text: "First copy." },
        { reference: "Ether 12:27", text: "Second copy." },
      ],
    });
    const ids = verses.map((v) => v.id);
    expect(ids[0]).toBe("ether-12-27");
    expect(ids[1]).toMatch(/^ether-12-27~[a-z0-9]+$/);
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps scripture search hits on their reference-slug id, matching /api/get", async () => {
    // Upstream search gives scripture hits source_type "scriptures", a
    // source_id, AND a real reference. The /api/get shape for the same
    // verse carries no source_id, so its id is the reference slug; a
    // search hit that took `scriptures-<source_id>` instead would not
    // dedupe against the saved verse (the store dedupes by id alone).
    stubFetch(() => ({
      ok: true,
      status: 200,
      body: {
        results: [
          {
            source_type: "scriptures",
            source_id: 4360,
            reference: "Ether 12:27",
            snippet: "And if men come unto me I will show unto them their weakness.",
          },
        ],
      },
    }));
    const results = await source().search("weakness");
    expect(results.map((v) => v.id)).toEqual(["ether-12-27"]);
    expect(mapGetResponse(SAMPLE_GET_RESPONSE).map((v) => v.id)).toContain("ether-12-27");
  });

  it("never lets a generated suffix collide with a later result's own id", () => {
    // Positional `-2` suffixing emitted `charity-2` for the second
    // `charity`, colliding with the third result's own id. The `~`
    // separator cannot appear in a canonical slug, so the generated
    // id is distinct by construction, in either order.
    const verses = mapGetResponse({
      verses: [
        { reference: "Charity", text: "First copy." },
        { reference: "Charity", text: "Second copy." },
        { reference: "Charity 2", text: "A different result whose own id is charity-2." },
      ],
    });
    const ids = verses.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("charity");
    expect(ids[1]).toMatch(/^charity~[a-z0-9]+$/);
    expect(ids[2]).toBe("charity-2");
  });

  it("never lets a generated suffix collide with an earlier result's own id", () => {
    // The suffixed canonical id sits BEFORE the repeated id.
    const verses = mapGetResponse({
      verses: [
        { reference: "Alma 32", text: "First copy." },
        { reference: "Alma 32 2", text: "A different result whose own id is alma-32-2." },
        { reference: "Alma 32", text: "Second copy." },
      ],
    });
    const ids = verses.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["alma-32", "alma-32-2", expect.stringMatching(/^alma-32~[a-z0-9]+$/)]);
  });

  it("leaves reference-slug ids untouched when ids are already unique", async () => {
    stubFetch(() => ({ ok: true, status: 200, body: SAMPLE_SEARCH_RESPONSE }));
    const results = await source().search("charity");
    expect(results.map((v) => v.id)).toEqual(["moroni-7-47"]);
  });
});

describe("isSameVerse identity across id schemes (#79)", () => {
  const allredText = "Plead for a desire to be filled with the gift of charity.";

  it("matches a legacy title-slug save to its document-id result by reference + text", () => {
    expect(
      isSameVerse(
        { id: "charity-never-faileth", reference: "Charity Never Faileth", text: allredText },
        { id: "talks-3161", reference: "Charity Never Faileth", text: allredText },
      ),
    ).toBe(true);
  });

  it("does not match a distinct same-titled document (different text)", () => {
    expect(
      isSameVerse(
        { id: "charity-never-faileth", reference: "Charity Never Faileth", text: allredText },
        {
          id: "talks-3086",
          reference: "Charity Never Faileth",
          text: "Charity is not a single act or a single virtue.",
        },
      ),
    ).toBe(false);
  });

  it("matches a chunk across list-local renumbering (subset and reordered responses)", () => {
    const chunk = { reference: "Charity Never Faileth", text: "Second chunk of the same talk." };
    expect(
      isSameVerse(
        { ...chunk, id: "charity-never-faileth-2" },
        { ...chunk, id: "charity-never-faileth" },
      ),
    ).toBe(true);
    expect(
      isSameVerse(
        { ...chunk, id: "charity-never-faileth-2" },
        { ...chunk, id: "charity-never-faileth-3" },
      ),
    ).toBe(true);
  });

  it("does not match a different chunk of the same document", () => {
    expect(
      isSameVerse(
        {
          id: "charity-never-faileth-2",
          reference: "Charity Never Faileth",
          text: "Second chunk.",
        },
        { id: "charity-never-faileth", reference: "Charity Never Faileth", text: "First chunk." },
      ),
    ).toBe(false);
  });
});

describe("per-chunk source identity (#79, Stephen's ruling)", () => {
  // Two chunks of ONE document (talks-3161), as the engine returns
  // them in a single response and in later subset responses.
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

  it("(a) a chunk returned alone keeps its own identity — not the first chunk's", () => {
    const a = mapSearchItem(chunkAItem);
    const b = mapSearchItem(chunkBItem);
    const bAlone = mapSearchItem(chunkBItem);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(bAlone).not.toBeNull();
    if (!a || !b || !bAlone) return;
    // Neither chunk ever carries the bare document id.
    expect(a.id).toMatch(/^talks-3161~[a-z0-9]+$/);
    expect(b.id).toMatch(/^talks-3161~[a-z0-9]+$/);
    expect(a.id).not.toBe(b.id);
    // B alone is the same item as B in [A, B] — same id, same key —
    // and is NOT the saved chunk A, despite the shared document id
    // the old code handed to whichever chunk arrived first.
    expect(bAlone.id).toBe(b.id);
    expect(bAlone.chunkKey).toBe(b.chunkKey);
    expect(isSameVerse(a, bAlone)).toBe(false);
    expect(isSameVerse(b, bAlone)).toBe(true);
  });

  it("(b) identity is stable across reordered responses", async () => {
    const source = () => new GospelEngineDataSource("https://engine.example", "stdy_test");
    stubFetch(() => ({ ok: true, status: 200, body: { results: [chunkAItem, chunkBItem] } }));
    const first = await source().search("charity");
    stubFetch(() => ({ ok: true, status: 200, body: { results: [chunkBItem, chunkAItem] } }));
    const reordered = await source().search("charity");
    const byText = (list: typeof first, text: string) => list.find((v) => v.text === text);
    for (const text of [chunkAItem.snippet, chunkBItem.snippet]) {
      expect(byText(reordered, text)?.id).toBe(byText(first, text)?.id);
      expect(byText(reordered, text)?.chunkKey).toBe(byText(first, text)?.chunkKey);
    }
    expect(new Set(first.map((v) => v.id)).size).toBe(2);
    expect(new Set(reordered.map((v) => v.id)).size).toBe(2);
  });

  it("keeps distinct documents distinct even when title and snippet both match", () => {
    const snippet = "An identical snippet in two different talks.";
    const one = mapSearchItem({ ...chunkAItem, snippet });
    const two = mapSearchItem({
      source_type: "talks",
      source_id: 3086,
      title: "Charity Never Faileth",
      snippet,
    });
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    if (!one || !two) return;
    expect(one.reference).toBe(two.reference);
    expect(one.text).toBe(two.text);
    expect(one.chunkKey).not.toBe(two.chunkKey);
    expect(isSameVerse(one, two)).toBe(false);
  });

  it("(c) Ether 12:27 control: a search snippet still matches its full /api/get text", () => {
    const snippetHit = mapSearchItem({
      source_type: "scriptures",
      source_id: 4360,
      reference: "Ether 12:27",
      snippet: "And if men come unto me I will show unto them their weakness.",
    });
    const fullVerses = mapGetResponse(SAMPLE_GET_RESPONSE);
    const full27 = fullVerses[0];
    const full28 = fullVerses[1];
    expect(snippetHit).not.toBeNull();
    expect(full27).not.toBeUndefined();
    if (!snippetHit || !full27 || !full28) return;
    // Different texts, same passage: the snippet is a truncated form
    // of the full verse text, and they must still be the same item.
    expect(snippetHit.text).not.toBe(full27.text);
    expect(snippetHit.chunkKey).toBe("scripture:ether-12-27");
    expect(full27.chunkKey).toBe("scripture:ether-12-27");
    expect(isSameVerse(snippetHit, full27)).toBe(true);
    // The neighbouring verse is a different passage and must not match.
    expect(isSameVerse(snippetHit, full28)).toBe(false);
  });

  it("gives explicitly non-scripture results titled like a passage their own chunk keys", () => {
    // An explicit source type takes precedence over the reference
    // heuristic: talks TITLED "Ether 12:27" are not the Ether 12:27
    // passage. Under the old derivation they all shared
    // `scripture:ether-12-27`, so saving one marked the others (and
    // the passage itself) as Added and blocked saving them.
    const talkOne = mapSearchItem({
      source_type: "talks",
      source_id: 111,
      title: "Ether 12:27",
      snippet: "An identical excerpt appearing in two different talks.",
    });
    const talkTwo = mapSearchItem({
      source_type: "talks",
      source_id: 222,
      title: "Ether 12:27",
      snippet: "An identical excerpt appearing in two different talks.",
    });
    const passage = mapSearchItem({
      source_type: "scriptures",
      source_id: 4360,
      reference: "Ether 12:27",
      snippet: "And if men come unto me I will show unto them their weakness.",
    });
    expect(talkOne).not.toBeNull();
    expect(talkTwo).not.toBeNull();
    expect(passage).not.toBeNull();
    if (!talkOne || !talkTwo || !passage) return;
    expect(passage.chunkKey).toBe("scripture:ether-12-27");
    expect(talkOne.chunkKey).not.toBe("scripture:ether-12-27");
    expect(talkTwo.chunkKey).not.toBe("scripture:ether-12-27");
    // Same title AND same text, different documents: still distinct.
    expect(talkOne.chunkKey).not.toBe(talkTwo.chunkKey);
    expect(isSameVerse(talkOne, talkTwo)).toBe(false);
    expect(isSameVerse(talkOne, passage)).toBe(false);
    expect(isSameVerse(talkTwo, passage)).toBe(false);
  });

  it("(d) bridges a legacy key-less save to the same chunk, and not to a different chunk", () => {
    const legacy = {
      id: "charity-never-faileth",
      reference: "Charity Never Faileth",
      text: chunkBItem.snippet,
    };
    const b = mapSearchItem(chunkBItem);
    const a = mapSearchItem(chunkAItem);
    expect(b).not.toBeNull();
    expect(a).not.toBeNull();
    if (!a || !b) return;
    expect(isSameVerse(legacy, b)).toBe(true);
    expect(isSameVerse(legacy, a)).toBe(false);
  });

  it("(d) bridges a legacy full-text scripture save to its search snippet by reference", () => {
    const full27 = mapGetResponse(SAMPLE_GET_RESPONSE)[0];
    expect(full27).not.toBeUndefined();
    if (!full27) return;
    const legacy = { id: full27.id, reference: full27.reference, text: full27.text };
    const snippetHit = mapSearchItem({
      source_type: "scriptures",
      source_id: 4360,
      reference: "Ether 12:27",
      snippet: "And if men come unto me I will show unto them their weakness.",
    });
    expect(snippetHit).not.toBeNull();
    if (!snippetHit) return;
    expect(legacy.text).not.toBe(snippetHit.text);
    expect(isSameVerse(legacy, snippetHit)).toBe(true);
  });
});

describe("DemoDataSource", () => {
  const demo = new DemoDataSource();

  it("returns exactly the referenced verse for reference queries", async () => {
    const results = await demo.search("Ether 12:27");
    expect(results).toHaveLength(1);
    expect(results[0]?.reference).toBe("Ether 12:27");
  });

  it("resolves the D&C alias to the demo verse", async () => {
    const results = await demo.search("D&C 18:10");
    expect(results).toHaveLength(1);
    expect(results[0]?.reference).toBe("Doctrine and Covenants 18:10");
  });

  it("keeps substring matching for keyword queries", async () => {
    const results = await demo.search("weakness");
    expect(results.map((v) => v.reference)).toContain("Ether 12:27");
  });
});

describe("toPlainText via mapGetResponse (#74)", () => {
  const mapOne = (text: string) =>
    mapGetResponse({ reference: "Elaine L. Jack, Relief Society talk", text })[0]?.text;

  it("strips markdown image syntax, keeping the alt text", () => {
    expect(
      mapOne(
        "![Elaine L. Jack](https://www.churchofjesuschrist.org/imgs/example) spoke on charity.",
      ),
    ).toBe("Elaine L. Jack spoke on charity.");
  });

  it("drops footnote sup markers and empty anchor tags entirely", () => {
    expect(mapOne("Charity is the pure love of Christ.<sup>[1](#fn-1)</sup>")).toBe(
      "Charity is the pure love of Christ.",
    );
    expect(mapOne('<a id="fn-21"></a>**21.** See Moroni 7.')).toBe("21. See Moroni 7.");
  });

  it("strips markdown headings, emphasis, and links, keeping the words", () => {
    expect(mapOne("# **Prayer**")).toBe("Prayer");
    expect(mapOne("Read [Moroni 7](https://example.test/moroni) on *charity* and _faith_.")).toBe(
      "Read Moroni 7 on charity and faith.",
    );
  });

  it("strips raw HTML tags and decodes common entities", () => {
    expect(mapOne("<p>Faith &amp; hope &lt;always&gt;</p>")).toBe("Faith & hope <always>");
  });

  it("leaves plain scripture text unchanged", () => {
    const plain =
      "And if men come unto me I will show unto them their weakness. I give unto men weakness that they may be humble;";
    expect(mapOne(plain)).toBe(plain);
  });
});

describe("toPlainText review-round cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("keeps words separated across block tags and line breaks", () => {
    expect(mapOne("<p>Faith</p><p>hope</p>")).toBe("Faith\nhope");
    expect(mapOne("Faith<br>hope")).toBe("Faith\nhope");
  });

  it("decodes decimal and hexadecimal numeric entities", () => {
    expect(mapOne("It&#8217;s charity &#x2014; the pure love")).toBe(
      "It’s charity — the pure love",
    );
  });

  it("runs the conversion on the /api/search path, not just /api/get", async () => {
    stubFetch(() => ({
      ok: true,
      status: 200,
      body: {
        results: [
          {
            reference: "Moroni 7:47",
            text: "![Charity](https://example.test/c) **But charity** is <em>the pure love of Christ</em>.<sup>[1](#fn-1)</sup>",
          },
        ],
      },
    }));
    const source = new GospelEngineDataSource("https://engine.example", "stdy_test");
    const results = await source.search("charity");
    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("Charity But charity is the pure love of Christ.");
  });
});

describe("toPlainText literal-text cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("preserves literal operators instead of treating them as emphasis", () => {
    expect(mapOne("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(mapOne("2 ** 3 ** 4")).toBe("2 ** 3 ** 4");
    expect(mapOne("A *real* emphasis")).toBe("A real emphasis");
  });

  it("keeps characters produced by entity decoding literal", () => {
    expect(mapOne("&#35; 1 priority")).toBe("# 1 priority");
    expect(mapOne("&#42;not emphasis&#42;")).toBe("*not emphasis*");
    expect(mapOne("Fish &#38; chips")).toBe("Fish & chips");
  });
});

describe("toPlainText numeric-operator cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("preserves asterisk operators between digits", () => {
    expect(mapOne("2*3*4")).toBe("2*3*4");
    expect(mapOne("2**3**4")).toBe("2**3**4");
    expect(mapOne("The lot measured 2*3*4 cubits and was *very* wide")).toBe(
      "The lot measured 2*3*4 cubits and was very wide",
    );
  });

  it("unwraps emphasis adjacent to digits when it is not an operator", () => {
    expect(mapOne("1*st*")).toBe("1st");
    expect(mapOne("1**st**")).toBe("1st");
    expect(mapOne("**3** Nephi")).toBe("3 Nephi");
  });
});

describe("toPlainText Copilot-round cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("handles destinations with balanced parentheses", () => {
    expect(mapOne("![Portrait](https://example.test/image_(small).png)")).toBe("Portrait");
    expect(mapOne("See [the talk](https://example.test/talk_(2024)) today")).toBe(
      "See the talk today",
    );
  });

  it("resolves reference-style images and drops reference definitions", () => {
    expect(mapOne("![Faith][image]\n\n[image]: https://example.test/faith.png")).toBe("Faith");
    expect(mapOne("Text.\n\n[^1]: A footnote definition with prose")).toBe("Text.");
  });

  it("keeps ordinary text that merely starts with a bracketed label", () => {
    expect(mapOne("[Note]: Remember to pray and serve.")).toBe(
      "[Note]: Remember to pray and serve.",
    );
  });

  it("keeps table cells as separate words", () => {
    expect(mapOne("<table><tr><td>Faith</td><td>hope</td></tr></table>")).toBe("Faith\nhope");
  });

  it("decodes entities exactly once", () => {
    expect(mapOne("&#38;lt;")).toBe("&lt;");
    expect(mapOne("Fish &amp; chips")).toBe("Fish & chips");
  });
});

describe("toPlainText fb81f6 review-round cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("does not let a rejected arithmetic pair swallow a later emphasis span", () => {
    expect(mapOne("2**3**4 and **faith**")).toBe("2**3**4 and faith");
    expect(mapOne("a **b** c **d** e")).toBe("a b c d e");
  });

  it("drops only footnote sup spans and keeps other superscripts as text", () => {
    expect(mapOne("Faith<sup>[1](#fn-1)</sup> grows")).toBe("Faith grows");
    expect(mapOne("the 19<sup>th</sup> century")).toBe("the 19th century");
    expect(mapOne("x<sup>2</sup> plus y")).toBe("x2 plus y");
  });

  it("drops reference definitions only at up to three leading spaces", () => {
    expect(mapOne("Text.\n\n   [1]: https://example.test/a")).toBe("Text.");
    expect(mapOne("Text.\n\n    [1]: https://example.test/a")).toBe(
      "Text.\n\n [1]: https://example.test/a",
    );
  });

  it("keeps the address in email autolinks", () => {
    expect(mapOne("Contact <help@example.org> today.")).toBe("Contact help@example.org today.");
    expect(mapOne("See <https://example.test/x> now.")).toBe("See https://example.test/x now.");
  });
});

describe("toPlainText manual-pass cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("strips links and images whose destinations nest parentheses two deep", () => {
    expect(mapOne("🎧 [Listen to Audio](https://example.test/a_(b_(c)).mp3)")).toBe(
      "🎧 Listen to Audio",
    );
    expect(mapOne("![Jesus Christ healing man](https://example.test/imgs/a_(b_(c)).jpg)")).toBe(
      "Jesus Christ healing man",
    );
    expect(mapOne("![family praying](https://example.test/imgs/a_(b_(c)).jpg)")).toBe(
      "family praying",
    );
  });

  it("strips links whose destination has an unbalanced parenthesis", () => {
    expect(mapOne("🎧 [Listen to Audio](https://example.test/a_(b.mp3)")).toBe(
      "🎧 Listen to Audio",
    );
    expect(mapOne("![family praying](https://example.test/imgs/a_(b.jpg)")).toBe("family praying");
  });

  it("keeps the label when a destination is cut off mid-URL", () => {
    expect(
      mapOne(
        "🎧 [Listen to Audio](https://media2.example.test/assets/teachings/2016-01-024-chapter-20-walking-the-saviors-path",
      ),
    ).toBe("🎧 Listen to Audio");
    expect(mapOne("[Listen to Audio](https://example.test/cut-off\n\nFollowing prose stays.")).toBe(
      "Listen to Audio\n\nFollowing prose stays.",
    );
  });

  it("drops empty-text links entirely", () => {
    // A result whose text is only empty-text links converts to
    // nothing, so the mapper drops it instead of returning a verse
    // with an empty body (CodeRabbit round on 5a0ed2d).
    expect(mapGetResponse({ reference: "Talk excerpt", text: "[](06_lecture_6.md)[]()" })).toEqual(
      [],
    );
    expect(mapOne("Text [](06_lecture_6.md) more")).toBe("Text more");
  });

  it("unescapes backslash-escaped punctuation", () => {
    expect(mapOne("1\\. Faith is knowing the sun will rise")).toBe(
      "1. Faith is knowing the sun will rise",
    );
    expect(mapOne("\\[Obedience\\] is a gospel principle")).toBe(
      "[Obedience] is a gospel principle",
    );
  });

  it("leaves bare bracketed words alone", () => {
    expect(mapOne("the [Obedience] principle")).toBe("the [Obedience] principle");
  });
});

describe("toPlainText round-3 cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("does not rescan nested bare brackets exponentially", () => {
    const nested = `${"[".repeat(30)}Faith${"]".repeat(30)}`;
    expect(mapOne(nested)).toBe(nested);
    // The already-processed label is consumed whole: an inner link
    // inside bare outer brackets is unwrapped exactly once.
    expect(mapOne("[[Moroni 7](https://example.test/m)]")).toBe("[Moroni 7]");
  });

  it("does not let a link destination scan cross into a later paragraph or line", () => {
    expect(mapOne("[Listen to Audio](https://example.test/cut-off\n\n2) Pray daily.")).toBe(
      "Listen to Audio\n\n2) Pray daily.",
    );
    expect(mapOne("[Listen](https://example.test/cut-off\n1) Faith")).toBe("Listen\n1) Faith");
  });

  it("preserves backslash-escaped punctuation as literal punctuation", () => {
    expect(mapOne("\\*faith\\*")).toBe("*faith*");
    expect(mapOne("\\_faith\\_")).toBe("_faith_");
    expect(mapOne("\\`code\\`")).toBe("`code`");
    expect(mapOne("\\*\\*faith\\*\\*")).toBe("**faith**");
    expect(mapOne("\\[not a link](https://example.test/x)")).toBe(
      "[not a link](https://example.test/x)",
    );
    // An escaped ampersand is literal, so what follows it is not an entity.
    expect(mapOne("\\&amp; chips")).toBe("&amp; chips");
  });

  it("drops results whose converted text is empty", () => {
    expect(mapGetResponse({ reference: "Talk excerpt", text: "<sup>[1](#fn-1)</sup>" })).toEqual(
      [],
    );
    expect(mapOne("Faith <sup>[1](#fn-1)</sup>")).toBe("Faith");
  });
});

describe("toPlainText round-4 cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("handles angle-bracket destinations containing parentheses", () => {
    expect(mapOne("[Read](<https://example.test/a)b>) today")).toBe("Read today");
    expect(mapOne("[Read](<https://example.test/a b>) today")).toBe("Read today");
  });

  it("resolves shortcut references to their label and keeps undefined shortcuts literal", () => {
    expect(mapOne("![Faith]\n\n[Faith]: https://example.test/faith.png")).toBe("Faith");
    expect(mapOne("[Faith]\n\n[Faith]: https://example.test/faith")).toBe("Faith");
    expect(mapOne("[Faith] and [Hope]")).toBe("[Faith] and [Hope]");
    // Case and whitespace differences still resolve.
    expect(mapOne("[FAITH]\n\n[Faith]: https://example.test/faith")).toBe("FAITH");
  });

  it("removes HTML comments but preserves comments inside code spans", () => {
    expect(mapOne("Faith<!-- editor note --> and hope")).toBe("Faith and hope");
    expect(mapOne("Faith `<!-- editor note -->` and hope")).toBe(
      "Faith <!-- editor note --> and hope",
    );
  });

  it("keeps code span contents literal", () => {
    expect(mapOne("The pattern is `*faith*`.")).toBe("The pattern is *faith*.");
    expect(mapOne("Use `<b>bold</b>` tags")).toBe("Use <b>bold</b> tags");
    expect(mapOne("Use ``a `b` c`` here")).toBe("Use a `b` c here");
  });

  it("converts many consecutive links correctly", () => {
    const input = Array.from({ length: 1000 }, () => "[Faith](https://example.test/faith)").join(
      " ",
    );
    const expected = Array.from({ length: 1000 }, () => "Faith").join(" ");
    expect(mapOne(input)).toBe(expected);
  });

  it("keeps bare brackets that span a paragraph boundary literal", () => {
    expect(mapOne("[Faith\n\nhope]")).toBe("[Faith\n\nhope]");
    expect(mapOne("the [Obedience] principle")).toBe("the [Obedience] principle");
  });
});

describe("toPlainText round-5 cases (#74)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("parses a quoted link title separately from the destination", () => {
    expect(mapOne('[Faith](https://example.test/faith "Faith ) hope")')).toBe("Faith");
    expect(mapOne('![Faith](https://example.test/faith "Faith ) hope")')).toBe("Faith");
    expect(mapOne("[Faith](https://example.test/faith 'Faith ) hope')")).toBe("Faith");
  });

  it("keeps reference-style text whose label has no definition", () => {
    expect(mapOne("Read [Faith][Hope] today.")).toBe("Read [Faith][Hope] today.");
    expect(mapOne("Read [Faith][Faith] today.\n\n[Faith]: https://example.test/faith")).toBe(
      "Read Faith today.",
    );
    expect(mapOne("Read [Faith][] today.\n\n[Faith]: https://example.test/faith")).toBe(
      "Read Faith today.",
    );
  });

  it("preserves backslashes inside code spans", () => {
    expect(mapOne("The code `\\*faith\\*` here")).toBe("The code \\*faith\\* here");
    // An escaped backtick outside a span is still a literal backtick.
    expect(mapOne("Faith \\` hope")).toBe("Faith ` hope");
  });

  it("separates words at opening block tags too", () => {
    expect(mapOne("<div>Faith<div>hope</div></div>")).toBe("Faith hope");
    expect(mapOne("Faith<p>hope</p>")).toBe("Faith hope");
    expect(mapOne("<p>Faith</p><p>hope</p>")).toBe("Faith\nhope");
  });

  it("does not treat footnote labels as link references", () => {
    expect(mapOne("Faith[^1]\n\n[^1]: Ibid.")).toBe("Faith[^1]");
    expect(mapOne("Faith[^2] and hope\n\n[^2]: See Ibid. p. 4")).toBe("Faith[^2] and hope");
  });

  it("handles many unmatched opening brackets without quadratic rescans", () => {
    const input = "[".repeat(20000) + "Faith";
    expect(mapOne(input)).toBe(input);
  });

  it("never matches brackets across a paragraph boundary, even past a backslash", () => {
    // A trailing hard-break backslash before the blank line must not
    // hide the boundary from the bracket matcher.
    const input = "Faith [hope\\\n\nlove](https://x) end";
    expect(mapOne(input)).toBe(input);
  });
});

describe("mapSearchItem verse identity (#79)", () => {
  // Verified live /api/search shape (2026-11-01, see docs/api-notes.md):
  // items carry source_type/source_id/title/snippet — no reference or
  // text field — and titles are NOT unique across documents: a
  // `charity` search returns two different "Charity Never Faileth"
  // talks. Deriving the Verse id from the title made those results
  // share one id, and the web list keys cards by id — duplicate React
  // keys orphaned a card's DOM node, which then persisted across
  // later searches and other tabs until reload.
  const allredTalk = {
    source_type: "talks",
    source_id: 3161,
    title: "Charity Never Faileth",
    speaker: "Silvia H. Allred",
    snippet: "Plead for a desire to be filled with the gift of charity.",
  };
  const otherTalkSameTitle = {
    source_type: "talks",
    source_id: 2044,
    title: "Charity Never Faileth",
    speaker: "Another Speaker",
    snippet: "A different talk that happens to share the title.",
  };

  it("gives same-title search results distinct ids from their document identity", () => {
    const a = mapSearchItem(allredTalk);
    const b = mapSearchItem(otherTalkSameTitle);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.reference).toBe("Charity Never Faileth");
    expect(b?.reference).toBe("Charity Never Faileth");
    expect(a?.id).toMatch(/^talks-3161~[a-z0-9]+$/);
    expect(b?.id).toMatch(/^talks-2044~[a-z0-9]+$/);
    expect(a?.id).not.toBe(b?.id);
    expect(a).toMatchObject({ sourceType: "talks", sourceId: "3161" });
    expect(b).toMatchObject({ sourceType: "talks", sourceId: "2044" });
  });

  it("keeps the reference-slug id for items without document identity", () => {
    const verse = mapSearchItem({
      reference: "Moroni 7:47",
      text: "But charity is the pure love of Christ.",
    });
    expect(verse?.id).toBe("moroni-7-47");
  });

  it("keeps the reference-slug id for scripture hits that carry a source identity", () => {
    const verse = mapSearchItem({
      source_type: "scriptures",
      source_id: 4360,
      reference: "Ether 12:27",
      snippet: "And if men come unto me I will show unto them their weakness.",
    });
    expect(verse?.id).toBe("ether-12-27");
    expect(verse).toMatchObject({ sourceType: "scriptures", sourceId: "4360" });
    expect(verse?.chunkKey).toBe("scripture:ether-12-27");
  });

  it("returns unique ids for a full search response of same-title results", async () => {
    stubFetch((url) =>
      url.includes("/api/search")
        ? {
            ok: true,
            status: 200,
            body: { results: [allredTalk, otherTalkSameTitle] },
          }
        : { ok: false, status: 404, body: {} },
    );
    const source = new GospelEngineDataSource("https://example.test", "key");
    const results = await source.search("charity");
    expect(results).toHaveLength(2);
    expect(new Set(results.map((v) => v.id)).size).toBe(2);
  });
});

describe("toPlainText truncated-link cases (#76)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("drops the dangling bracket when an excerpt truncates a link mid-label", () => {
    // The "Faith" guide card's "See also" line, as seen in the PR #75
    // manual preview pass: the excerpt cut "[Obedience](…)" off
    // before its closing syntax, leaving a lone "[" in the card.
    expect(
      mapOne(
        "- See also Assurance; Baptism, Qualifications for; Believe; Confidence; Faithful; Faithfulness; [Obedi",
      ),
    ).toBe(
      "- See also Assurance; Baptism, Qualifications for; Believe; Confidence; Faithful; Faithfulness; Obedi",
    );
    expect(mapOne("See also [Obedi")).toBe("See also Obedi");
  });

  it("drops the dangling image bracket when an excerpt truncates an image mid-alt", () => {
    expect(mapOne("Portrait: ![Elaine L. Ja")).toBe("Portrait: Elaine L. Ja");
  });

  it("drops a lone trailing bracket at the input edge", () => {
    expect(mapOne("Faith; [")).toBe("Faith;");
  });

  it("keeps unmatched brackets that are not a trailing fragment", () => {
    // The fragment continues onto another line: not an excerpt cut.
    expect(mapOne("Faith [hope\ncharity")).toBe("Faith [hope\ncharity");
    // An HTML line break counts too: the link scanner runs before
    // the HTML pass turns <br> into "\n".
    expect(mapOne("Faith [hope<br>charity")).toBe("Faith [hope\ncharity");
    // But only a complete tag counts — the HTML pass requires the
    // closing ">", so an excerpt cut inside the tag itself ("<br"
    // with no ">") is still a truncated fragment and its dangling
    // bracket drops.
    expect(mapOne("See [Faith<br")).toBe("See Faith<br");
  });

  it("keeps literal bracket notation in complete text", () => {
    // This converter also runs on complete chapter/talk text, where a
    // "[" can be literal notation rather than markup: an interval's
    // fragment carries a ")" that no "(" in the fragment opened, so
    // the bracket stays.
    expect(mapOne("Value in [0, 1) is valid.")).toBe("Value in [0, 1) is valid.");
  });

  it("counts escaped parens in the truncated-fragment depth check", () => {
    // Escaped parens are protected as placeholders before the link
    // scanner runs; the depth check must count them as parens or the
    // two cases below resolve inconsistently (Copilot review of the
    // post-merge head, PR #78). An escaped ")" is still a close no
    // "(" in the fragment opened, so the literal bracket stays; an
    // escaped "(" in a truncated label still leaves the bracket
    // dangling, so it drops like the unescaped case above.
    expect(mapOne("Value in [0, 1\\) is valid.")).toBe("Value in [0, 1) is valid.");
    expect(mapOne("See [Faith \\(part")).toBe("See Faith (part");
  });

  it("drops the dangling bracket when a truncated label contains a parenthesis", () => {
    // Labels and alt text can carry parentheses; a "(" the fragment
    // itself opened does not make the bracket literal.
    expect(mapOne("See [Faith (part")).toBe("See Faith (part");
    expect(mapOne("Portrait: ![Elaine L. Jack (speaker")).toBe("Portrait: Elaine L. Jack (speaker");
  });

  it("drops a truncated linked image's prefix but keeps the outer literal bracket", () => {
    // "[![alt](img)](page)" cut mid-alt: the outer "[" is a literal
    // bracket (a link label is not markup), the inner image's "!["
    // is truncated syntax and drops together.
    expect(mapOne("Portrait: [![Elaine L. Ja")).toBe("Portrait: [Elaine L. Ja");
  });
});

describe("toPlainText replacement-character cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("drops the replacement characters an engine excerpt leaves at its truncation point", () => {
    // The "Chapter 2: Pray Always" card from the PR #75 manual pass:
    // the engine builds search snippets by slicing the source text at
    // a byte limit, cutting a multibyte character (the dash in the
    // page range after "46") in two; its JSON encoder turns each
    // leftover byte into U+FFFD, and the snippet's own "…" follows.
    expect(
      mapOne(
        "“Chapter 2: Pray Always,” Teachings of Presidents of the Church: Ezra Taft Benson (2014), 46\uFFFD\uFFFD…",
      ),
    ).toBe(
      "“Chapter 2: Pray Always,” Teachings of Presidents of the Church: Ezra Taft Benson (2014), 46…",
    );
  });

  it("drops replacement characters from search-result snippets", () => {
    // Search cards map through mapSearchItem's snippet field, the
    // field the engine's byte-sliced excerpt arrives in.
    expect(
      mapSearchItem({
        reference: "Chapter 2: Pray Always",
        snippet: "Ezra Taft Benson (2014), 46\uFFFD\uFFFD…",
      })?.text,
    ).toBe("Ezra Taft Benson (2014), 46…");
  });

  it("drops a single replacement character and tidies the gap it leaves", () => {
    expect(mapOne("Faith \uFFFD hope")).toBe("Faith hope");
    expect(mapOne("\uFFFDFaith and hope\uFFFD")).toBe("Faith and hope");
  });

  it("drops unpaired surrogates, which render as replacement characters", () => {
    // A lone surrogate half (e.g. from a UTF-16 slice through an
    // astral character) displays as U+FFFD in the card.
    expect(mapOne("Faith\uD83D hope")).toBe("Faith hope");
    expect(mapOne("Faith hope\uDC00")).toBe("Faith hope");
  });

  it("keeps valid astral characters intact", () => {
    // Engine text carries real emoji (e.g. the 🎧 audio marker):
    // a well-formed surrogate pair is content, not corruption.
    expect(mapOne("🎧 Listen to Audio")).toBe("🎧 Listen to Audio");
  });

  it("treats text that is only replacement characters as no result", () => {
    expect(mapGetResponse({ reference: "Talk excerpt", text: "\uFFFD\uFFFD" })).toEqual([]);
  });
});

describe("toPlainText replacement-character round-2 cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("drops replacement characters reintroduced by numeric entity decoding", () => {
    // The first-pass cleanup runs before entity decoding, so an
    // encoded U+FFFD (&#65533; / &#xFFFD;) used to survive decoding
    // and render in the card after all.
    expect(mapOne("Faith &#65533; hope")).toBe("Faith hope");
    expect(mapOne("Faith &#xFFFD; hope")).toBe("Faith hope");
    expect(mapOne("&#65533; &amp; faith")).toBe("& faith");
  });

  it("treats entity-only replacement characters as no result", () => {
    expect(mapGetResponse({ reference: "Talk excerpt", text: "&#65533;" })).toEqual([]);
    expect(mapGetResponse({ reference: "Talk excerpt", text: "&#xFFFD;" })).toEqual([]);
  });

  it("does not mistake literal private-use markers in source text for a code-span placeholder", () => {
    // The code-span placeholder pair used to be U+E060/U+E061: a
    // literal "\uE0600\uE061" sequence in engine text was then read
    // back as "span 0" at restore time and replaced with the span's
    // content ("Faith and Faith end"). The markers are now chosen
    // per input starting at U+E066/U+E067, clear of that literal
    // sequence (round 4 covers literals matching the active pair).
    expect(mapOne("`Faith` and \uE0600\uE061 end")).toBe("Faith and \uE0600\uE061 end");
  });

  it("keeps code-span content free of replacement artifacts", () => {
    // Span content is restored after the main cleanup, so it is
    // cleaned again at restore time; a well-formed pair survives.
    expect(mapOne("`Faith\uD83D` hope")).toBe("Faith hope");
    expect(mapOne("`Faith\uFFFD` hope")).toBe("Faith hope");
    expect(mapOne("`🎧 Listen` now")).toBe("🎧 Listen now");
  });
});

describe("toPlainText replacement-character round-3 cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("never fuses two unpaired surrogate halves around a dropped U+FFFD into a character", () => {
    // Dropping U+FFFD first would join "\uD83D" and "\uDE00" into a
    // fabricated 😀; unpaired surrogates are dropped first instead.
    expect(mapOne("Faith \uD83D\uFFFD\uDE00 hope")).toBe("Faith hope");
    expect(mapGetResponse({ reference: "Talk excerpt", text: "\uD83D\uFFFD\uDE00" })).toEqual([]);
  });

  it("drops a code span whose whole content is replacement corruption", () => {
    // The cleanup runs after code spans are captured, so the span's
    // content is cleaned at restore time and an emptied span leaves
    // no stray backticks behind.
    expect(mapGetResponse({ reference: "Talk excerpt", text: "`\uFFFD`" })).toEqual([]);
    expect(mapGetResponse({ reference: "Talk excerpt", text: "`\uD83D\uFFFD\uDE00`" })).toEqual([]);
    expect(mapOne("Faith`\uFFFD` hope")).toBe("Faith hope");
  });

  it("keeps the backslash behavior when a backslash precedes U+FFFD", () => {
    // The escape-aware code-span scanner pairs the backslash with
    // the U+FFFD after it; moving the cleanup behind that scan must
    // not change the outcome (a lone backslash stays, as it does for
    // any non-punctuation escape).
    expect(mapOne("Faith \\\uFFFD hope")).toBe("Faith \\ hope");
  });
});

describe("toPlainText replacement-character round-4 cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("does not mistake a literal sequence matching the active placeholder pair for a code span", () => {
    // The placeholder pair is chosen per input, so a literal
    // "\uE0660\uE067" sequence — the pair earlier rounds settled on —
    // stays literal text instead of being replaced with span 0's
    // content ("Faith and Faith end").
    expect(mapOne("`Faith` and \uE0660\uE067 end")).toBe("Faith and \uE0660\uE067 end");
    expect(mapOne("Faith \uE0660\uE067 end")).toBe("Faith \uE0660\uE067 end");
  });

  it("keeps choosing collision-free placeholders when several pairs occur literally", () => {
    // Both the first candidate pair (U+E066/U+E067) and the next
    // (U+E068/U+E069) occur as literal placeholder-shaped sequences,
    // so a later candidate must be used and both literals survive.
    expect(mapOne("`Faith` and \uE0660\uE067 plus \uE0680\uE069 end")).toBe(
      "Faith and \uE0660\uE067 plus \uE0680\uE069 end",
    );
  });

  it("does not let a numeric entity forge a code-span placeholder", () => {
    // "&#57446;" / "&#57447;" are U+E066 / U+E067 in decimal: they
    // decode after spans are protected, so the marker choice must
    // have accounted for the decoded form too.
    expect(mapOne("`Faith` and &#57446;0&#57447; end")).toBe("Faith and \uE0660\uE067 end");
    expect(mapOne("`Faith` and &#xE066;0&#xE067; end")).toBe("Faith and \uE0660\uE067 end");
  });

  it("treats code spans that clean to whitespace as no result", () => {
    // The placeholders used to restore after whitespace
    // normalization and trimming, so these restored to one or two
    // spaces and buildVerse kept them as blank cards.
    expect(mapGetResponse({ reference: "Talk excerpt", text: "`\uFFFD` `\uFFFD`" })).toEqual([]);
    expect(mapGetResponse({ reference: "Talk excerpt", text: "` \uFFFD `" })).toEqual([]);
  });

  it("tidies the gap a code span leaves when its content cleans away", () => {
    expect(mapOne("Faith `\uFFFD` hope")).toBe("Faith hope");
    expect(mapOne("` \uFFFD ` and faith")).toBe("and faith");
  });
});

describe("toPlainText replacement-character round-5 cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("does not let replacement-artifact cleanup forge a code-span placeholder", () => {
    // The U+FFFD between the literal marker and the digit is dropped
    // by the cleanup, joining "\uE066" + "0" + "\uE067" into a
    // placeholder-shaped sequence after the markers were chosen.
    expect(mapOne("`Faith` and \uE066\uFFFD0\uE067 end")).toBe("Faith and \uE0660\uE067 end");
  });

  it("does not let an encoded replacement character forge a code-span placeholder", () => {
    // "&#65533;" decodes to nothing, so decoding joins the encoded
    // markers and the digit the same way.
    expect(mapOne("`Faith` and &#57446;&#65533;0&#57447; end")).toBe("Faith and \uE0660\uE067 end");
    expect(mapOne("`Faith` and &#xE066;&#xFFFD;0&#xE067; end")).toBe("Faith and \uE0660\uE067 end");
  });
});

describe("toPlainText replacement-character round-6 cases (#77)", () => {
  const mapOne = (text: string) => mapGetResponse({ reference: "Talk excerpt", text })[0]?.text;

  it("unwraps many emptied spans in one pass, keeping real spans at every index", () => {
    // Interleave corruption-only spans with real ones past index 9:
    // the unwrap must match each placeholder's full index, so span
    // 10+ content survives and every emptied span disappears.
    const parts: string[] = [];
    const expected: string[] = [];
    for (let i = 0; i < 15; i++) {
      parts.push("`\uFFFD`", `\`word${i}\``);
      expected.push(`word${i}`);
    }
    expect(mapOne(parts.join(" "))).toBe(expected.join(" "));
  });
});

describe("suppliesMissingVerseIdentity (#79 review)", () => {
  const base = { id: "x", reference: "Ether 12:27", text: "And if men come unto me." };

  it("is false when the incoming verse supplies nothing the saved verse lacks", () => {
    // A chunkKey-only saved verse (demo / /api/get shape) re-found by
    // the same chunkKey-only result: nothing new to persist.
    const chunkKeyOnly = { ...base, chunkKey: "scripture:ether-12-27" };
    expect(suppliesMissingVerseIdentity(chunkKeyOnly, chunkKeyOnly)).toBe(false);
    // An already-complete saved verse re-found by its own result.
    const complete = {
      ...base,
      chunkKey: "talks:3161:abc",
      sourceType: "talks",
      sourceId: "3161",
    };
    expect(suppliesMissingVerseIdentity(complete, complete)).toBe(false);
    // A saved verse missing a field the incoming verse also lacks.
    expect(suppliesMissingVerseIdentity(chunkKeyOnly, { ...base })).toBe(false);
  });

  it("is true when the incoming verse fills a genuinely missing field", () => {
    const chunkKeyOnly = { ...base, chunkKey: "talks:3161:abc" };
    expect(
      suppliesMissingVerseIdentity(chunkKeyOnly, {
        ...chunkKeyOnly,
        sourceType: "talks",
        sourceId: "3161",
      }),
    ).toBe(true);
    // A key-less legacy save gains the whole identity.
    expect(suppliesMissingVerseIdentity(base, { ...base, chunkKey: "talks:3161:abc" })).toBe(true);
  });
});
