# Search & adding verses — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: Playwright covers demo-set search rendering and the
demo-mode placeholder keyword example (`App.test.e2e.ts`), fixture-mocked
proxy search and add-to-library
(`SearchTab.test.e2e.ts`, `SearchTab.test.e2e.ts`), and the in-place
"Added" confirmation state on a result whose verse is in the library
(`App.test.e2e.ts`). Real-engine behavior
below cannot run in CI — the fixtures pin the documented response
shapes, not the live service._

**Preconditions:** Network access to the live engine via the
production proxy (web search is server-key-only; there is no user
API key to enter).

1. **Live keyword search.** Via the production proxy, search a
   common keyword (e.g. `faith`). **Expected:** real
   results render with references and readable text; results are not
   limited to the demo set.
2. **Live reference lookup.** Search an exact reference not in the demo
   set (e.g. `Alma 32:21`). **Expected:** that single passage renders;
   adding it puts the correct reference and text in My verses.
3. **Invalid reference handling.** Search a nonsense reference
   (e.g. `Hezekiah 99:99`). **Expected:** a clear no-results or
   human-readable error state — never a raw stack/error code, a spinner
   that never ends, or a crash.
4. **Slow-connection behavior.** Throttle the network (browser devtools)
   and search. **Expected:** the searching indicator shows while waiting;
   the Search button cannot trigger duplicate in-flight searches.
5. **Consecutive searches leave no stale results (#79).** Search
   `charity`, note the result cards (both "Charity Never Faileth" talks
   render as separate cards), then search a different keyword (e.g.
   `faith`) without reloading. **Expected:** only the new search's
   results are shown — no card from the previous search persists in
   the list or reappears after switching tabs and back.

**Run when:** `packages/web/src/components/SearchTab.tsx`,
`packages/web/api/**` (the edge proxy), `packages/web/src/lib/gospel.ts`,
`packages/core/src/scripture.ts`, the `@spudly/ui` `VerseSearchPage`.
