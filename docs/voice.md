# The Memorize voice

The voice chart for Memorize (#110, Stage 3), decided 2026-11-07 as
part of the i18n program (architecture: spudly/design-system#539 —
voice-as-theme). This document is the single source both app
packages (`packages/web`, `packages/app`) reference; the catalogs in
each package's `src/locales/` are where the voice is applied, string
by string.

## Character

Memorize speaks as a **steady, reverent companion**:

- **Reverent** — the app sits next to scripture; its own words stay
  respectful of that, without performing piety.
- **Steady and patient** — the tone does not rush, scold, or hype.
  Progress is presented as it is, at whatever pace it comes.
- **Grace on return** — a return after absence is welcomed plainly.
  Never streak-shame: no broken-streak language, no guilt framing,
  no "you lost your progress" framing for time away. Absence is
  normal; picking up again is the whole point.
- **Plain and clear** — modern, direct wording. No thee/thou
  pastiche, no faux-King-James styling of the app's own words.
- **Quietly encouraging** — credit is given for showing up and for
  finishing, stated once and simply, never inflated.
- **Warm and companionable** — the app is alongside the user in the
  practice, not above it.

## The one flourish: wry understatement

A hint of wry understatement is allowed **only** in low-stakes
mechanical moments — a word slipping during a drill, a review queue
being long — and it is aimed at the situation or the app, never at
the user, never at scripture, and never at the user's practice.
It stays out of:

- errors (errors are plain — see below),
- returns after absence, milestones, and devotional content,
- anything about the text being memorized.

When in doubt, be plain.

## Errors

Errors stay plain: what happened, what it means for the user's
work, and what to do next, with no flourish and no blame. Example
from the catalogs: "Couldn't save your progress — it isn't saved
yet if you leave now."

## The boundary: scripture is quoted, never re-voiced

Scripture text itself is **quoted content** from Bible
translations. It is never re-voiced, paraphrased, modernized, or
punch-up'd by this voice. The voice covers only the app's own words
around the text — headings, prompts, feedback, empty states,
errors.

## Applying the voice

- Every user-facing app string goes through the Lingui catalogs
  (`packages/web/src/locales/`, `packages/app/src/locales/`); new
  strings are written to this chart first, then catalogued.
- Page-unique copy flows through the catalogs into page `copy`
  props. Shared-component text will come from the DS-typed voice
  object once design-system #539 ships its slot types/provider in
  `@spudly/ui`; that wiring is sequenced behind #539 and is not
  part of the Lingui foundation.
- Review test for a new string: (1) Would this shame a returning
  user? (2) Does it sound like it's quoting scripture when it
  isn't? (3) If it's an error, is it plain? (4) If it's wry, is the
  moment genuinely low-stakes and mechanical?
