# Memorization drill — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: Playwright covers entering the drill, blank reveal, a full
seven-round completion marking the verse memorized, the too-many-peeks
retry, and round persistence across reload (`App.test.e2e.ts`,
`DrillView.test.e2e.ts`). The cases below are the manual remainder._

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
