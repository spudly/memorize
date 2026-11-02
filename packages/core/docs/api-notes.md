# gospel-engine API notes

The `GospelEngineDataSource` in `src/scripture.ts` talks to the community
[gospel-engine](https://github.com/cpuchip/gospel-engine) REST API. There is
no official Church API; this is a third-party service.

Default base URL: `https://engine.ibeco.me`

> The /api/get shape below is **VERIFIED** (live sample captured 2026-10-16,
> pinned as a fixture in `tests/scripture.test.ts`). The /api/search shape
> was **VERIFIED** on 2026-11-01 against the production proxy (see Search
> below); its mapper stays defensive.

## Getting a key

1. Sign in with Google at https://engine.ibeco.me/keys
2. Create a key (shown once). Keys look like `stdy_…` and are sent as
   `Authorization: Bearer <key>`.

## Search

```sh
curl -H "Authorization: Bearer $GOSPEL_ENGINE_KEY" \
  "https://engine.ibeco.me/api/search?q=charity"
```

/api/search is keyword + semantic (vector) + hybrid search over the WHOLE
library — scriptures, conference talks, manuals, books, study aids — so a
reference typed into it returns mostly unrelated material. That is why
`GospelEngineDataSource.search()` routes reference-shaped queries to
/api/get first (see `parseReference`) and only uses /api/search for
keywords or as a fallback when the lookup misses.

Live shape (verified 2026-11-01, `GET /api/search?q=charity` through the
production proxy): `{ mode, query, results: [...] }` where each item
carries `source_type`, `source_id`, `title`, `snippet`, `file_path`,
`web_url`, `score`, and for talks `speaker` / `year` / `month` — there is
no `reference` or `text` field. Titles are NOT unique across documents
(a `charity` search returns two different "Charity Never Faileth"
talks), so the Verse `id` for a non-scripture search item is derived
from `source_type` + `source_id`, never from the title alone (#79).
A search item is one CHUNK of its document, and each chunk is its own
memorizable item (Stephen's ruling on #79, 2026-11-01), so the mapper
also persists the item's `source_type` / `source_id` on the Verse and
derives a per-chunk `chunkKey` (`<source_type>:<source_id>:<hash of
the chunk's text>`); the finished Verse `id` is
`<source_type>-<source_id>~<chunk text hash>`. The document identity
alone must never identify a result: a later response returning a
different chunk of the same document alone would hand it the first
chunk's id, and the two chunks would be mistaken for one item.
Scripture hits are the exception: upstream gives them a real
`reference`, and they keep the reference-slug id (`ether-12-27`) so a
verse has the same id via search and via `/api/get`; their `chunkKey`
is `scripture:<reference-slug>` — text-independent on purpose, so a
search snippet still matches the full `/api/get` text of the same
passage (Ether 12:27). Verses saved before `chunkKey` existed carry
no source identity; `isSameVerse` bridges them by reference + text
(and by reference for scripture passages), and the store annotates a
legacy entry with the verified identity on its first such match.

The mapper accepts either a top-level JSON array or an object with a
`results` / `items` / `verses` / `data` array. Each item is read with these
field fallbacks:

- reference: `reference`, `ref`, `citation`, `title`
- text: `text`, `verse_text`, `content`, `body`, `snippet`
- optional: `book` / `book_name`, `chapter` / `chapter_number` (string or number)

## Get verses by reference (verified 2026-10-16)

```sh
curl -H "Authorization: Bearer $GOSPEL_ENGINE_KEY" \
  "https://engine.ibeco.me/api/get?ref=Ether%2012%3A27-28"
```

The parameter is **`ref`** (an earlier draft of these notes said
`reference`; the live API was queried with `ref`). A reference may be a
verse, a range, or a chapter. Response shape:

```json
{
  "reference_query": "Ether 12:27-28",
  "source_type": "scriptures",
  "verses": [
    {
      "id": 4360,
      "volume": "bofm",
      "book": "ether",
      "chapter": 12,
      "verse": 27,
      "reference": "Ether 12:27",
      "text": "And if men come unto me …",
      "file_path": "/data/gospel-library/eng/scriptures/bofm/ether/12.md"
    }
  ]
}
```

One `verses` item per verse; `chapter` is a JSON number and `book` is a
lowercase slug. Known data quirk: the extracted text can contain
missing-space artifacts (e.g. "willshow", "showunto" in Ether 12) — that
is in the upstream data, not the mapping. `mapGetResponse` maps the
`verses` array (and tolerates a single-object payload). A 404 is treated
as "no such reference".

### Chapter-only references (verified 2026-10-16, upstream source)

A chapter-only reference (e.g. `Alma 32`) does NOT return a `verses`
array. Verified against upstream `internal/api/server.go` (`getChapter`):

```json
{
  "reference_query": "Alma 32",
  "source_type": "chapters",
  "chapter": {
    "id": 901,
    "volume": "bofm",
    "book": "alma",
    "chapter": 32,
    "title": "Alma 32",
    "full_content": "<the chapter's full text>",
    "file_path": "/data/gospel-library/eng/scriptures/bofm/alma/32.md"
  }
}
```

`mapChapterResponse` maps this envelope to a single Verse (reference =
`reference_query`, text = `full_content`, kept whole — its internal
verse formatting is unverified, so it is not split into per-verse
entries). Without this mapping a successful chapter lookup mapped to
`[]` and the search silently fell back to semantic search.

## MCP endpoint (not used by the app)

The same tools are exposed as streamable HTTP MCP at
`https://engine.ibeco.me/mcp?key=$GOSPEL_ENGINE_KEY` (tools include
`gospel_search`, `gospel_get`, `gospel_related`, `gospel_citations`,
`gospel_list`). The app uses the REST API directly because it needs no MCP
client runtime.

## What to verify once you have a key

1. ~~The /api/get response shape and parameter name~~ — done 2026-10-16
   (see above; fixture in `tests/scripture.test.ts`).
2. ~~The real field names for reference/text in /api/search results~~ — done
   2026-11-01 (see above; fixture in `tests/scripture.test.ts`).
3. Pagination / result limits on search (the app currently takes the first page).
4. Rate limits (600 requests/minute per token per the project README; the
   client surfaces HTTP 429 as a `ScriptureApiError` with `status` set).

Update `mapSearchItem` / `mapVerseDetail` in `src/scripture.ts` to match, and
add a test in `tests/` pinning the real shape.
