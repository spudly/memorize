import {
  DemoDataSource,
  GospelEngineDataSource,
  mapGetResponse,
  mapSearchItem,
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
