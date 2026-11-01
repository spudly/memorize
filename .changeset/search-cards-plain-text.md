---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix full-library search cards rendering raw markdown/HTML markup in
result text (#74): text mapped from the gospel engine is now converted
to readable plain text in @memorize/core — markdown images keep their
alt text, footnote `<sup>` markers and empty anchor tags are dropped,
headings/emphasis/links keep their words, remaining HTML tags are
stripped, and common entities are decoded. Scripture verse text, which
is already plain, passes through unchanged.
