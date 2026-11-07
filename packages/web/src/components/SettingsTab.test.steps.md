# Settings — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: Playwright `SettingsTab.test.e2e.ts` covers that the settings
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
