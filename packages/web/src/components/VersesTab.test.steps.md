# My verses — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: Playwright `VersesTab.test.e2e.ts` covers rendering seeded verses
with status/text and removing a verse (persisted); `App.test.e2e.ts` covers
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
