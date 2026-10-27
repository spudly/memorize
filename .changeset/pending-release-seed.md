---
"@memorize/app": minor
---

Adopt changesets pending releases: the four @memorize/* packages are aligned
to 1.0.0 (matching the app's expo.version) and versioned as one fixed group,
so production deploys can be gated on a reviewed Pending Release PR instead
of shipping on every merge.
