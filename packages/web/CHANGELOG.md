# @memorize/web

## 1.1.3

### Patch Changes

- f52c512: Fix replacement characters (U+FFFD) showing in some search-result card
  text (#77): the gospel engine builds search snippets by slicing source
  text at a byte limit, so a multibyte character at the cut point reached
  the app as replacement characters (e.g. "…(2014), 46��…" on the
  "Chapter 2: Pray Always" card). Text mapped from the engine in
  @memorize/core now drops U+FFFD characters and unpaired surrogates,
  which render the same way, so cards show the readable excerpt text
  with its trailing "…" and no "��".
- Updated dependencies [f52c512]
  - @memorize/core@1.1.3
  - @memorize/types@1.1.3

## 1.1.2

### Patch Changes

- 6763990: Fix the production web build serving the built-in demo set to visitors
  without a local API key (#63): the Vercel deployment now compiles with
  VITE_USE_GOSPEL_PROXY=1 (committed .env.production, which Vite reads at
  build time, plus build-time env in vercel.json), so production search
  goes through the same-origin edge proxy to the full library and the
  Search tab no longer shows the demo notice in that state.
- d63d305: Fix full-library search returning keyword results for a nonsense
  reference (#70): a reference-shaped query naming an explicit verse
  (e.g. "Hezekiah 99:99") whose exact lookup finds nothing now returns
  no results instead of falling back to semantic search, which silently
  ignored the chapter/verse and matched the book name alone.
  Chapter-only references to a nonexistent chapter of a known book
  (e.g. "Ether 16") also return no results on a miss. Chapter-only
  queries that name no known book ("lesson 3") or end in a year-like
  4-digit number ("general conference 2024") are keyword searches and
  keep the semantic fallback, as do lookup errors other than a 400.
- fe75991: Fix full-library search cards rendering raw markdown/HTML markup in
  result text (#74): text mapped from the gospel engine is now converted
  to readable plain text in @memorize/core — markdown images keep their
  alt text, footnote `<sup>` markers and empty anchor tags are dropped,
  headings/emphasis/links keep their words, remaining HTML tags are
  stripped, and common entities are decoded. Scripture verse text is
  already plain. Whitespace is normalized and the text is trimmed.
- Updated dependencies [6763990]
- Updated dependencies [d63d305]
- Updated dependencies [fe75991]
  - @memorize/core@1.1.2
  - @memorize/types@1.1.2

## 1.1.1

### Patch Changes

- 8dacea3: In demo mode, the Search tab's placeholder now suggests a keyword the
  built-in demo set can actually match ("weakness", which finds
  Ether 12:27) instead of "charity", which returns no results in demo
  mode. Full-library mode keeps the original example. The demo notice
  and placeholder now follow the effective search source: in proxy
  builds (Vercel), a visitor without a local API key searches the full
  library, so the Search tab no longer describes the built-in demo set
  in that case.
- 149503c: On web, search results now confirm an add in place: after "Add to
  memorize list" is clicked, the result's button changes to a disabled
  "Added" state without leaving the Search tab, and a verse that is
  already in the library shows "Added" instead of an Add button (the add
  itself already deduped silently, so the button gave no signal either
  way). The native app's search screen is unchanged.
- eae2572: Web: the production bundle is code-split (memorize#54, Option B). The
  drill, search, review and settings surfaces load lazily on first
  navigation instead of shipping in the initial chunk, and the React and
  design-system/Tamagui runtime ships as separate vendor chunks. The app
  entry chunk drops from ~554 kB to ~25 kB, no chunk exceeds Vite's
  500 kB warning threshold, and the build no longer prints the chunk-size
  hint. No user-visible behavior changes.
- Updated dependencies [8dacea3]
- Updated dependencies [149503c]
- Updated dependencies [eae2572]
  - @memorize/core@1.1.1
  - @memorize/types@1.1.1

## 1.1.0

### Patch Changes

- 314389b: Memorize web now runs on @spudly/ui 1.14.0 (from 0.4.1; the app package's
  dependency aligns to the same version). On web, the memorization drill's
  hidden-word blanks now flow inline within the verse text at every round
  instead of stacking as blocks that break the sentence apart. The inline
  messages in the drill, search, and settings tabs render with the design
  system's consolidated Alert component, and the web app creates its
  Tamagui config from the design system's current Memorize (Quiet Dawn)
  theme, with the Raleway and Alegreya typefaces loaded.
- Updated dependencies [314389b]
  - @memorize/core@1.1.0
  - @memorize/types@1.1.0
