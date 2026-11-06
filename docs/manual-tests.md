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
  major `@spudly/ui` upgrades or changes to storage or the spaced
  repetition schedule.
- **Environment.** Runs execute against the Memorize web preview
  deployment (Vercel preview for the change under test), or production
  (https://memorize-ivory.vercel.app) for smoke checks of a release.
  Memorize has no accounts of its own: all state is local to the browser,
  so test data never touches another user's data.
- **Who runs it.** An AI agent driving a browser, or a person by hand.
  Steps are written so either can execute them.
- **Test data.** Verses added during a run are prefixed `QA —` in notes
  or chosen from the built-in demo set when demo mode suffices. Clean up
  created data at the end of a run (remove QA verses) unless a case says
  to keep it for a later case in the same run. There is no user
  gospel-engine API key (#101): web search runs on the server key via
  the edge proxy, and native search uses the built-in demo set.

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
3. In demo mode (a build without the gospel proxy), search
   `Ether 12:27` in the Search tab.
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
   **Expected:** status badges are visually distinct; a verse with a
   review scheduled shows a readable "Next review: `<date>`" line, and a
   verse with no review scheduled shows no schedule line at all.
3. **Remove and re-add.** Remove a verse, then search and re-add the same
   reference. **Expected:** the re-added verse starts fresh (learning,
   drill round reset) — no resurrected progress from the removed entry.

**Run when:** `packages/web/src/components/VersesTab.tsx`,
`packages/app` verses screens, the `@spudly/ui` `MyVersesPage`,
`packages/core/src/store.ts` verse actions.

---

## Search & adding verses

_Automated: Playwright covers demo-set search rendering and the
demo-mode placeholder keyword example (`app.spec.ts`), fixture-mocked
proxy search and add-to-library
(`proxy/search.spec.ts`, `proxy/add.spec.ts`), and the in-place
"Added" confirmation state on a result whose verse is in the library
(`app.spec.ts`). Real-engine behavior
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

4. **Canonical drill URL (web).** Copy a verse's Drill link from My
   verses (it points at `/drill/<verse-id>`), open it in a fresh tab /
   fresh page load. **Expected:** the app loads straight into that
   verse's drill session; Back returns to My verses, and the browser
   Back button re-enters the drill. On native, opening
   `memorize://drill/<verse-id>` (e.g. via `adb shell am start -a
android.intent.action.VIEW -d memorize://drill/<verse-id>`) lands
   on the same verse's drill.

**Run when:** `packages/web/src/components/DrillView.tsx`,
`packages/app` drill/session screens, `packages/core/src/drill.ts`,
the `@spudly/ui` `MemorizationSessionPage`, drill routing in
`packages/web/src/App.tsx` (`/drill/:id`) or `packages/app/src/App.tsx`
(`memorize://drill/<id>` deep links).

---

## Settings

_Automated: Playwright `settings.spec.ts` covers that the settings
page renders no API-key section and no Google Drive sync section.
There are no API-key cases anymore (#101): the key section was
removed from the settings page on every platform (DS #439), web
search is server-key-only by design, and native search uses the
built-in demo set. The cases below are the manual remainder._

**Preconditions:** The web preview (proxy build) and, for case 3, a
native build.

1. **No API-key UI anywhere.** Open Settings on web and on native.
   **Expected:** the page shows only its "Settings" heading — no
   API-key field, no Save key / Clear key controls, and nothing in
   the app asks for a key.
2. **Web search runs on the server key.** In the web preview, run
   case 1 of the Search section without entering any key (there is
   nowhere to enter one). **Expected:** full-library results, and
   the Search tab does not describe the built-in demo set.
3. **Native search is the demo set.** On native, search a reference
   from the demo set and one that is not. **Expected:** the demo
   passage renders for the first; the second reports no results
   from the demo set — native never calls the live engine.

**Run when:** `packages/web/src/components/SettingsTab.tsx`,
`packages/app` settings screens, the `@spudly/ui`
`MemorizeSettingsPage`, `packages/web/src/lib/gospel.ts`,
`packages/app/src/lib.ts`.

---

## Data persistence & recovery

_Automated: Playwright covers verse adds, drill progress, and review
rescheduling across reloads. The cases below involve browser-level
state the suites deliberately do not destroy._

**Preconditions:** A browser profile with verses and drill progress.

1. **Browser restart persistence.** Fully close and reopen the browser,
   then open the app. **Expected:** library, drill progress, and review
   schedule are all intact.
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
`packages/core/src/store.ts` persistence path,
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
   add, drill advance. **Expected:** focus is always
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
