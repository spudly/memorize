# @memorize/app

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
