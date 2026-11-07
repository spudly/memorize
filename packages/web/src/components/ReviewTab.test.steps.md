# Review (spaced repetition) — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: Playwright `ReviewTab.test.e2e.ts` covers due-only listing,
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
