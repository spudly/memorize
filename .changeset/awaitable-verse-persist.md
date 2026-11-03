---
"@memorize/web": patch
"@memorize/app": patch
"@memorize/core": patch
"@memorize/types": patch
---

Fix verse mutations persisting fire-and-forget (#91): the store's verse
mutations (add/remove verse, drill progress, drill completion, review
recording) wrote to AsyncStorage via `void persist()`, so a mutation
could be silently lost if the process died before the write landed. The
mutations in @memorize/core now return the persistence promise, and the
drill screens (app and web) await drill progress and drill completion —
completion is awaited before navigating back — so drill progress the
user sees is progress that has actually been saved. Saves are also
serialized in the store: storage backends do not promise ordering for
concurrent writes, and an older full snapshot landing after a newer
one would silently revert it.
