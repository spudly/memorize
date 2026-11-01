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
Chapter-only references to a nonexistent chapter of a known book
(e.g. "Ether 16") also return no results on a miss. Chapter-only
queries that name no known book ("lesson 3") or end in a year-like
4-digit number ("general conference 2024") are keyword searches and
keep the semantic fallback, as do lookup errors other than a 400.
