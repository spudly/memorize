---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Web: the production bundle is code-split (memorize#54, Option B). The
drill, search, review and settings surfaces load lazily on first
navigation instead of shipping in the initial chunk, and the React and
design-system/Tamagui runtime ships as separate vendor chunks. The app
entry chunk drops from ~554 kB to ~25 kB, no chunk exceeds Vite's
500 kB warning threshold, and the build no longer prints the chunk-size
hint. No user-visible behavior changes.
