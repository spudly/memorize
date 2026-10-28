---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Search results now confirm an add in place: after "Add to memorize list"
is clicked, the result's button changes to a disabled "Added" state
without leaving the Search tab, and a verse that is already in the
library shows "Added" instead of an Add button (the add itself already
deduped silently, so the button gave no signal either way).
