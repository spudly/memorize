---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

In demo mode, the Search tab's placeholder now suggests a keyword the
built-in demo set can actually match ("weakness", which finds
Ether 12:27) instead of "charity", which returns no results in demo
mode. Full-library mode keeps the original example. The demo notice
and placeholder now follow the effective search source: in proxy
builds (Vercel), a visitor without a local API key searches the full
library, so the Search tab no longer describes the built-in demo set
in that case.
