# @memorize/types

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
