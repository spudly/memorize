import {
  DemoDataSource,
  GospelEngineDataSource,
  mapGetResponse,
  parseReference,
  ScriptureApiError,
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
      id: "alma-32",
      reference: "Alma 32",
      book: "alma",
      chapter: "32",
      text: "Chapter text stand-in for Alma 32.",
    });
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
