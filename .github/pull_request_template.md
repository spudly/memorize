## Summary

<!-- One or two sentences: what does this PR do? -->

## What changed and why

<!-- The changes and the motivation. Link the issue this addresses. -->

## Pre-merge checklist

All boxes must be checked (or struck through with a one-line reason)
before this PR is merged.

- [ ] CI is green for the exact head commit
- [ ] Review feedback addressed (Copilot and/or human)
- [ ] Manual test pass posted for this head SHA in this PR's preview
      deployment, scoped to this PR's changes, or exempt
      (release/Dependabot/docs-CI-only, or no matching manual-test
      triggers)
- [ ] No new console or CI warnings introduced — or a GitHub issue filed
      for each new one
- [ ] Manual test plan (`docs/manual-tests.md`) updated, or no
      user-visible behavior change
- [ ] Manual tests for the changed areas run against this PR's preview
      deployment and passed, or not applicable (no behavior change,
      docs-only, or version-only)
- [ ] If this PR bumps @spudly/ui: manual tests cover the design-system
      changes in the bumped version range (per the DS changelog), or
      none of those changes are user-visible
