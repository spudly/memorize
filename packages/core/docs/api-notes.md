# gospel-engine API notes

The `GospelEngineDataSource` in `src/scripture.ts` talks to the community
[gospel-engine](https://github.com/cpuchip/gospel-engine) REST API. There is
no official Church API; this is a third-party service.

Default base URL: `https://engine.ibeco.me`

> The exact JSON response shapes below are **UNVERIFIED** — the API requires a
> key, and the field mapping in `src/scripture.ts` (`mapSearchItem` /
> `mapVerseDetail`) was written defensively against the project's README.
> Verify with the curl commands below once you have a key, then tighten the
> mappers and add a regression test.

## Getting a key

1. Sign in with Google at https://engine.ibeco.me/keys
2. Create a key (shown once). Keys look like `stdy_…` and are sent as
   `Authorization: Bearer <key>`.

## Search

```sh
curl -H "Authorization: Bearer $GOSPEL_ENGINE_KEY" \
  "https://engine.ibeco.me/api/search?q=charity"
```

The mapper accepts either a top-level JSON array or an object with a
`results` / `items` / `verses` / `data` array. Each item is read with these
field fallbacks:

- reference: `reference`, `ref`, `citation`, `title`
- text: `text`, `verse_text`, `content`, `body`, `snippet`
- optional: `book` / `book_name`, `chapter` / `chapter_number`

## Get a single verse

```sh
curl -H "Authorization: Bearer $GOSPEL_ENGINE_KEY" \
  "https://engine.ibeco.me/api/get?reference=Ether%2012%3A27"
```

The mapper also unwraps one level of nesting under `verse`, `result`,
`data`, or `item` before applying the same field fallbacks.

## MCP endpoint (not used by the app)

The same tools are exposed as streamable HTTP MCP at
`https://engine.ibeco.me/mcp?key=$GOSPEL_ENGINE_KEY` (tools include
`gospel_search`, `gospel_get`, `gospel_related`, `gospel_citations`,
`gospel_list`). The app uses the REST API directly because it needs no MCP
client runtime.

## What to verify once you have a key

1. The real field names for reference/text in search results.
2. Whether `GET /api/get` returns the verse at the top level or nested.
3. Pagination / result limits on search (the app currently takes the first page).
4. Rate limits (the README mentions per-token buckets; the client surfaces
   HTTP 429 as a `ScriptureApiError` with `status` set).

Update `mapSearchItem` / `mapVerseDetail` in `src/scripture.ts` to match, and
add a test in `tests/` pinning the real shape.
