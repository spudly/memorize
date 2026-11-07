# Manual Test Plan

Manual tests are the tests that are **not run via Jest or Playwright**.
This document is the maintained index of that non-automated test
surface: the flows that are visual, exploratory, gesture- or
timing-based, dependent on real external services or accounts, or
otherwise unsuited to the automated suites. If a behavior is covered
by a Jest test or a Playwright test, it does not belong in the manual
steps; when a manual case becomes automated, remove it from its steps
file in the same PR that adds the automation.

Since issue #108 the per-area manual steps live in colocated
`*.test.steps.md` files next to the primary source file they exercise
(see the index below). This document keeps the shared material that
has no single source file: how runs work, the smoke baseline, the
test-data rules, and the Maestro suite notes.

## How runs work

- **Selective runs (the norm).** Each steps file ends with a **Run
  when:** line naming the changes that trigger it (repo paths and/or
  `@spudly/ui` components/pages). A QA sweep for a change exercises
  the smoke baseline plus the steps files whose triggers match the
  change's delta — find them by grepping for `*.test.steps.md`.
- **Full regression.** Run every steps file in the index below. A
  full regression is run when explicitly requested, and is the right
  scope for major `@spudly/ui` upgrades or changes to storage or the
  spaced repetition schedule.
- **Environment.** Runs execute against the Memorize web preview
  deployment (Vercel preview for the change under test), or
  production (https://memorize-ivory.vercel.app) for smoke checks of
  a release. Memorize has no accounts of its own: all state is local
  to the browser, so test data never touches another user's data.
- **Who runs it.** An AI agent driving a browser, or a person by
  hand. Steps are written so either can execute them.
- **Test data.** Verses added during a run are prefixed `QA —` in
  notes or chosen from the built-in demo set when demo mode suffices.
  Clean up created data at the end of a run (remove QA verses) unless
  a case says to keep it for a later case in the same run. There is
  no user gospel-engine API key (#101): web search runs on the
  server key via the edge proxy, and native search uses the built-in
  demo set.

## Maintaining the manual steps

- **Every PR that adds or changes user-visible behavior updates the
  relevant steps file in the same PR** — add cases for new behavior,
  adjust steps or expected results for changed behavior, and delete
  cases for removed behavior. A new area with no steps file yet gets
  one next to its primary source file, named
  `<Base>.test.steps.md`, carrying its own **Run when:** line, and a
  link added to the index below.
- PRs that do not change user-visible behavior (refactors, tooling,
  test infrastructure, dependency bumps with no behavior change)
  need no update.
- Keep cases concrete and executable: real screens, routes, and
  controls, with the expected result stated — not general
  intentions.
- When a case is automated (Jest or Playwright), remove it from its
  steps file and say so in the PR description.
- **Working agreement (issue #45):** when a QA sweep finds a
  functional bug in a flow Playwright can cover, the fix PR adds the
  Playwright regression test for it — automated coverage grows where
  defects actually occur, and any manual case it replaces is removed
  from its steps file.

---

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

## Steps files index

| Area                               | Steps file                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| My verses                          | [VersesTab.test.steps.md](../packages/web/src/components/VersesTab.test.steps.md)     |
| Search & adding verses             | [SearchTab.test.steps.md](../packages/web/src/components/SearchTab.test.steps.md)     |
| Review (spaced repetition)         | [ReviewTab.test.steps.md](../packages/web/src/components/ReviewTab.test.steps.md)     |
| Memorization drill                 | [DrillView.test.steps.md](../packages/web/src/components/DrillView.test.steps.md)     |
| Settings                           | [SettingsTab.test.steps.md](../packages/web/src/components/SettingsTab.test.steps.md) |
| Data persistence & recovery        | [storage.test.steps.md](../packages/core/src/storage.test.steps.md)                   |
| Visual, responsive & accessibility | [App.test.steps.md](../packages/web/src/App.test.steps.md)                            |

---

## Android use-case tests (Maestro)

Phase 2 of issue #29: end-to-end flows that install the release APK
on an emulator and exercise the app's core use cases, so functional
regressions (not just build breaks) are caught in CI. Since issue
#108 the flows are colocated next to the screens they exercise as
`*.test.e2e.yaml` files:

| Flow                                                  | Covers                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/app/src/App.test.e2e.yaml`                  | App launches to the Verses tab; empty state renders                                                   |
| `packages/app/src/screens/SearchScreen.test.e2e.yaml` | Search a reference, passage text displays, verse adds to My verses                                    |
| `packages/app/src/screens/DrillScreen.test.e2e.yaml`  | Drill renders blanks, accepts peek input, rounds advance; verse + round persist across an app restart |

Test data is self-contained: CI configures no gospel-engine API key,
so the app searches its bundled demo set (the search flow asserts the
demo banner to prove it). No live API, no account.

### When it runs

The `android-usecases` job in `.github/workflows/android.yml`, gated
by the same decision as the Android build: release PRs (head branch
`changeset-release/**`) and manual `workflow_dispatch` runs. Ordinary
PRs skip it; the required `android-gate` check still reports and
passes on the skip, and fails if the suite fails when it does run.

### Run locally

> **Warning:** the flows launch the app with `clearState`, which
> wipes all `com.memorize.app` data on the device — saved verses,
> drill progress, and any gospel-engine API key in Settings. Run
> them on a dedicated emulator, or back that data up first.

With an emulator running, build the release APK the same way CI
does (from the repository root). `npm ci` installs the private
`@spudly/ui` package from GitHub Packages, so export a token with
`read:packages` first (a `gh` login token works:
`export NODE_AUTH_TOKEN=$(gh auth token)`):

```sh
corepack enable npm
npm ci
npx turbo run build --filter=@memorize/app^...
(cd packages/app && npx expo prebuild --platform android --no-install)
(cd packages/app/android && ./gradlew assembleRelease)
adb install -r packages/app/android/app/build/outputs/apk/release/app-release.apk
maestro test packages/app/src/App.test.e2e.yaml packages/app/src/screens/SearchScreen.test.e2e.yaml packages/app/src/screens/DrillScreen.test.e2e.yaml
```

Maestro CLI version is pinned in the workflow (2.12.1).
