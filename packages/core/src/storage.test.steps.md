# Data persistence & recovery — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

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
