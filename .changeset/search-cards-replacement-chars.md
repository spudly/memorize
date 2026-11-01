---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix replacement characters (U+FFFD) showing in some search-result card
text (#77): the gospel engine builds search snippets by slicing source
text at a byte limit, so a multibyte character at the cut point reached
the app as replacement characters (e.g. "…(2014), 46��…" on the
"Chapter 2: Pray Always" card). Text mapped from the engine in
@memorize/core now drops U+FFFD characters and unpaired surrogates,
which render the same way, so cards show the readable excerpt text
with its trailing "…" and no "��".
