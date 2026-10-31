---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix the production web build serving the built-in demo set to visitors
without a local API key (#63): the Vercel deployment now compiles with
VITE_USE_GOSPEL_PROXY=1 (committed .env.production, which Vite reads at
build time, plus build-time env in vercel.json), so production search
goes through the same-origin edge proxy to the full library and the
Search tab no longer shows the demo notice in that state.
