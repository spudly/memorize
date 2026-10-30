# @memorize/app

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

### Minor Changes

- b0fa449: Adopt changesets pending releases: the four @memorize/* packages are aligned
  to 1.0.0 (matching the app's expo.version) and versioned as one fixed group,
  so production deploys can be gated on a reviewed Pending Release PR instead
  of shipping on every merge.

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
