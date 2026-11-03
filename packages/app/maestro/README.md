# Android use-case tests (Maestro)

Phase 2 of issue #29: end-to-end flows that install the release APK
on an emulator and exercise the app's core use cases, so functional
regressions (not just build breaks) are caught in CI.

| Flow                         | Covers                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `launch.yaml`                | App launches to the Verses tab; empty state renders                                                   |
| `search-and-add.yaml`        | Search a reference, passage text displays, verse adds to My verses                                    |
| `drill-and-persistence.yaml` | Drill renders blanks, accepts peek input, rounds advance; verse + round persist across an app restart |

Test data is self-contained: CI configures no gospel-engine API key,
so the app searches its bundled demo set (the search flow asserts the
demo banner to prove it). No live API, no account.

## When it runs

The `android-usecases` job in `.github/workflows/android.yml`, gated
by the same decision as the Android build: release PRs (head branch
`changeset-release/**`) and manual `workflow_dispatch` runs. Ordinary
PRs skip it; the required `android-gate` check still reports and
passes on the skip, and fails if the suite fails when it does run.

## Run locally

With an emulator running and a release APK built
(`npx expo prebuild --platform android` then
`./gradlew assembleRelease` in `packages/app/android`):

```sh
adb install -r packages/app/android/app/build/outputs/apk/release/app-release.apk
maestro test packages/app/maestro
```

Maestro CLI version is pinned in the workflow (2.12.1).
