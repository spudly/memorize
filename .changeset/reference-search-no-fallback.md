---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix full-library search returning keyword results for a nonsense
reference (#70): a reference-shaped query (e.g. "Hezekiah 99:99") whose
exact lookup finds nothing now returns no results instead of falling
back to semantic search, which silently ignored the chapter/verse and
matched the book name alone. Lookup errors still fall back.
