---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix full-library search returning keyword results for a nonsense
reference (#70): a reference-shaped query naming an explicit verse
(e.g. "Hezekiah 99:99") whose exact lookup finds nothing now returns
no results instead of falling back to semantic search, which silently
ignored the chapter/verse and matched the book name alone.
Chapter-only references to a nonexistent chapter (e.g. "Ether 16")
also return no results on a miss; only a chapter-only query with a
year-like (4-digit) trailing number keeps the semantic fallback,
since it can be a keyword search ending in a year (e.g. "general
conference 2024"), as do lookup errors other than a 400.
