# Manual Test Plan

Manual tests are the tests that are **not run via Jest or Playwright**.
This document is the maintained record of that non-automated test surface:
the flows that are visual, exploratory, gesture- or timing-based,
dependent on real external services or accounts, or otherwise unsuited to
the automated suites. If a behavior is covered by a Jest test or a
Playwright test, it does not belong here; when a manual case becomes
automated, remove it from this document in the same PR that adds the
automation.

## How runs work

- **Selective runs (the norm).** Each feature section ends with a **Run
  when:** line naming the changes that trigger it (repo paths and/or
  `@spudly/ui` components/pages). A QA sweep for a change exercises the
  smoke baseline plus the sections whose triggers match the change's
  delta.
- **Full regression.** Run every section in this document. A full
  regression is run when explicitly requested, and is the right scope for
  major `@spudly/ui` upgrades or changes to storage, sync, or the spaced
  repetition schedule.
- **Environment.** Runs execute against the Memorize web preview
  deployment (Vercel preview for the change under test), or production
  (https://memorize-ivory.vercel.app) for smoke checks of a release.
  Memorize has no accounts of its own: all state is local to the browser
  plus the user's own Google Drive, so test data never touches another
  user's data.
- **Who runs it.** An AI agent driving a browser, or a person by hand.
  Steps are written so either can execute them.
- **Test data.** Verses added during a run are prefixed `QA —` in notes
  or chosen from the built-in demo set when demo mode suffices. Clean up
  created data at the end of a run (remove QA verses, clear the API key,
  disconnect Drive test files) unless a case says to keep it for a later
  case in the same run. Cases that need a real gospel-engine API key or a
  real Google account use the dedicated QA credentials, never personal
  ones.

## Maintaining this document

- **Every PR that adds or changes user-visible behavior updates this
  document in the same PR** — add cases for new behavior, adjust steps or
  expected results for changed behavior, and delete cases for removed
  behavior.
- PRs that do not change user-visible behavior (refactors, tooling, test
  infrastructure, dependency bumps with no behavior change) need no
  update.
- Keep cases concrete and executable: real screens, routes, and controls,
  with the expected result stated — not general intentions.
- When a case is automated (Jest or Playwright), remove it here and say
  so in the PR description.
- **Working agreement (issue #45):** when a QA sweep finds a functional
  bug in a flow Playwright can cover, the fix PR adds the Playwright
  regression test for it — automated coverage grows where defects
  actually occur, and any manual case it replaces is removed here.

## Smoke baseline — run on every sweep

No feature section substitutes for this baseline; it runs first, every
time.

1. Open the site root (`/`). **Expected:** the app loads with no blank
   screen, no error overlay, and no uncaught console errors; the
   "Memorize" heading and the four tabs (My verses, Search, Review,
   Settings) render.
2. Open each tab in turn. **Expected:** each renders its view (empty
   states are fine) with no console errors.
3. In demo mode (no API key), search `Ether 12:27` in the Search tab.
   **Expected:** the demo passage renders with its full text.
4. Add the verse, open the Drill from My verses, and advance one round.
   **Expected:** the drill renders the verse and the round indicator
   advances.

---

## My verses

_Automated: Playwright `verses.spec.ts` covers rendering seeded verses
with status/text and removing a verse (persisted); `app.spec.ts` covers
the empty state. The cases below are the manual remainder._

**Preconditions:** A browser profile with at least two verses in the
library (one learning, one memorized).

1. **Long-list rendering.** Build a list of 25+ verses (demo adds are
   fine). Scroll the full list. **Expected:** every card renders its
   reference, status badge, and text without overlap, truncation of the
   reference, or layout shift as cards render.
2. **Badge and schedule readability.** Compare a learning verse and a
   memorized verse, including one with no review scheduled.
   **Expected:** status badges are visually distinct; "Next review" /
   "Not scheduled" lines are readable and correctly reflect each verse.
3. **Remove and re-add.** Remove a verse, then search and re-add the same
   reference. **Expected:** the re-added verse starts fresh (learning,
   drill round reset) — no resurrected progress from the removed entry.

**Run when:** `packages/web/src/components/VersesTab.tsx`,
`packages/app` verses screens, `@spudly/ui` `Card`/`Badge`/`EmptyState`
components or the memorize verses pages, `packages/core/src/store.ts`
verse actions.

---

## Search & adding verses

_Automated: Playwright covers demo-set search rendering
(`app.spec.ts`), fixture-mocked proxy search and add-to-library
(`proxy/search.spec.ts`, `proxy/add.spec.ts`), and the in-place
"Added" confirmation state on a result whose verse is in the library
(`app.spec.ts`). Real-engine behavior
below cannot run in CI — the fixtures pin the documented response
shapes, not the live service._

**Preconditions:** QA gospel-engine API key (Settings cases cover
entering it); network access to the live engine.

1. **Live keyword search.** With the QA key set (or via the production
   proxy), search a common keyword (e.g. `faith`). **Expected:** real
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

**Run when:** `packages/web/src/components/SearchTab.tsx`,
`packages/web/api/**` (the edge proxy), `packages/web/src/lib/gospel.ts`,
`packages/core/src/scripture.ts`, `@spudly/ui` `SearchField` or the
memorize search page.

---

## Review (spaced repetition)

_Automated: Playwright `review.spec.ts` covers due-only listing,
grading "remembered" and "forgot" against seeded state, persistence of
the rescheduled date, and the nothing-due empty state. The schedule math
itself is Jest-covered in `packages/core`. The cases below are the
manual remainder._

**Preconditions:** A browser profile with verses at several schedule
stages; a way to move the system clock or wait a day for case 2
(optional).

1. **End-of-session feel.** Grade every due verse in a session of 5+.
   **Expected:** each graded card leaves the list immediately with no
   flicker or re-render of already-graded cards; the session ends on the
   "Nothing due" state.
2. **Next-day due return.** Grade a verse "remembered" today; return
   tomorrow (or advance the clock). **Expected:** the verse is due again
   on the new day, and its "Next review" line in My verses agreed with
   that date beforehand.
3. **Forgot resets visibly.** Grade a long-scheduled verse "forgot".
   **Expected:** in My verses its next review is tomorrow (start of the
   daily schedule), not its old long-interval date.

**Run when:** `packages/web/src/components/ReviewTab.tsx`,
`packages/app` review screens, `packages/core/src/schedule.ts`,
`@spudly/ui` memorize review page components.

---

## Memorization drill

_Automated: Playwright covers entering the drill, blank reveal, a full
seven-round completion marking the verse memorized, the too-many-peeks
retry, and round persistence across reload (`app.spec.ts`,
`drill-session.spec.ts`). The cases below are the manual remainder._

**Preconditions:** A verse with a long text (e.g. 1 Nephi 3:7 from the
demo set) in the library.

1. **Late-round readability.** Drill the long verse to rounds 5–7
   (65–95% blanked). **Expected:** the remaining words and blanks stay
   legible and tappable; blanks never overlap or run off the card, on a
   narrow (phone-width) viewport as well as desktop.
2. **Peek accuracy.** In a middle round, peek exactly one blank.
   **Expected:** only that word is revealed; the revealed word is the one
   that belongs in that position (spot-check against the full text in My
   verses).
3. **Abandon mid-drill.** Start a drill, advance two rounds, use Back,
   then re-enter the drill from My verses. **Expected:** the drill
   resumes at the persisted round (by design) and Back never loses the
   verse or its earlier progress.

**Run when:** `packages/web/src/components/DrillView.tsx`,
`packages/app` drill/session screens, `packages/core/src/drill.ts`,
`@spudly/ui` `BlankWord`/`VerseText` or the memorization session page.

---

## Settings & API key

_Automated: Playwright `settings.spec.ts` covers saving a key (persisted
to local secret storage, Clear offered, survives reload) and clearing it.
The cases below need the real service and are manual._

**Preconditions:** QA gospel-engine API key; one deliberately invalid
key string.

1. **Valid key unlocks live search.** Save the QA key, then run case 1
   of the Search section. **Expected:** full-library results, and the
   Search tab no longer describes the built-in demo set.
2. **Invalid key failure mode.** Save an invalid key and search.
   **Expected:** a human-readable error (never a raw status/code dump),
   the app stays usable, and clearing the key returns search to the
   working demo set.
3. **Key is never synced.** With a key saved, run a Drive sync (Drive
   section), then inspect `memorize-data.json` in Drive.
   **Expected:** the file contains verses and settings but no API key
   anywhere in it.

**Run when:** `packages/web/src/components/SettingsTab.tsx`,
`packages/app` settings screens, `packages/core/src/storage.ts` secrets
handling, `packages/web/src/lib/gospel.ts`.

---

## Google Drive sync

_Automated: Playwright `settings.spec.ts` covers only the signed-out /
unconfigured state (section renders; an attempt without an OAuth client
ID reports that in-page). Real OAuth is out of scope for CI, so the
whole connected flow below is manual._

**Preconditions:** QA Google account; two browser profiles (or two
browsers) signed into it; a saved API key in profile A (to re-verify
case 3 of the Settings section end to end).

1. **First sync round trip.** In profile A, add two verses and sync.
   **Expected:** sync reports success; a `Memorize` folder containing
   `memorize-data.json` exists in the QA Drive. In profile B (fresh,
   empty library), sync. **Expected:** profile B's library now matches
   profile A.
2. **Conflict choice.** With both profiles holding the same list, add
   different verses in each, then sync profile B. **Expected:** the
   conflict UI appears naming both sides' change times; "Keep this
   device" and "Keep Drive" each resolve to exactly the chosen side's
   list on the next sync.
3. **Sign-in failure is graceful.** Start a sync and cancel the Google
   sign-in popup. **Expected:** an in-page message explains the failure;
   local data is unchanged; no half-written Drive file.

**Run when:** `packages/web/src/components/SettingsTab.tsx` sync
section, `packages/web/src/lib/driveAuth.ts`, `packages/app` settings /
Drive code, `packages/core/src/drive.ts`.

---

## Data persistence & recovery

_Automated: Playwright covers verse adds, drill progress, review
rescheduling, and API key persistence across reloads. The cases below
involve browser-level state the suites deliberately do not destroy._

**Preconditions:** A browser profile with verses, drill progress, and a
saved API key.

1. **Browser restart persistence.** Fully close and reopen the browser,
   then open the app. **Expected:** library, drill progress, review
   schedule, and the saved key are all intact.
2. **Corrupted local data.** Corrupt the `memorize:data:v1` local
   storage value (devtools) and reload. **Expected:** the app recovers
   to a usable state (empty library is acceptable) with no crash loop
   or permanent blank screen; note the observed behavior in the run
   report either way.
3. **Private/incognito session.** Open the app in a private window, add
   a verse, close the window, reopen privately. **Expected:** state is
   gone (browser semantics) and the app presents its normal first-run
   empty states rather than errors.

**Run when:** `packages/core/src/storage.ts`,
`packages/web/src/lib/storage.ts`, store initialization in
`packages/web/src/App.tsx` or `packages/app`.

---

## Visual, responsive & accessibility

_Automated: none — Playwright specs assert content and state, not
rendering quality. (Android visual regression for the design system
lives in the design-system repo and does not cover these web views.)_

**Preconditions:** The demo set suffices; a phone-width viewport (or a
phone) and keyboard-only navigation for case 2.

1. **Narrow viewport pass.** At ~360px wide, walk all four tabs plus a
   drill session. **Expected:** no horizontal scrolling, no clipped
   buttons or badges, verse text wraps readably.
2. **Keyboard pass.** Navigate the app by keyboard alone: tabs, search,
   add, drill advance, settings save. **Expected:** focus is always
   visible, every action is reachable, and Enter in the search field
   triggers the search.
3. **Zoom / large text.** At 200% browser zoom, repeat the smoke
   baseline. **Expected:** content reflows without overlap; the drill
   remains completable.
4. **Contrast spot check.** Check badge text, hint text, and the drill's
   blank placeholders against their backgrounds. **Expected:** all
   remain readable in the light theme.

**Run when:** `@spudly/ui` theme/token or shared component changes,
`packages/web/src/index.css`, layout changes in any
`packages/web/src/components/*.tsx`, `@spudly/ui` version bumps whose
changelog lists changed components used by Memorize.
