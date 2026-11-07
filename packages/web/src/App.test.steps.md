# Visual, responsive & accessibility — manual test steps

Colocated manual test steps for this area (issue #108). The maintained index for all manual test steps is `docs/manual-tests.md` at the repository root.

_Automated: none — Playwright specs assert content and state, not
rendering quality. (Android visual regression for the design system
lives in the design-system repo and does not cover these web views.)_

**Preconditions:** The demo set suffices; a phone-width viewport (or a
phone) and keyboard-only navigation for case 2.

1. **Narrow viewport pass.** At ~360px wide, walk all four tabs plus a
   drill session. **Expected:** no horizontal scrolling, no clipped
   buttons or badges, verse text wraps readably.
2. **Keyboard pass.** Navigate the app by keyboard alone: tabs, search,
   add, drill advance. **Expected:** focus is always
   visible, every action is reachable, and Enter in the search field
   triggers the search.
3. **Zoom / large text.** At 200% browser zoom, repeat the smoke
   baseline. **Expected:** content reflows without overlap; the drill
   remains completable.
4. **Contrast spot check.** Check badge text, hint text, and the drill's
   blank placeholders against their backgrounds. **Expected:** all
   remain readable in the light theme.

**Run when:** `@spudly/ui` theme/token or shared component changes,
`packages/web/src/index.css`, layout changes in any
`packages/web/src/components/*.tsx`, `@spudly/ui` version bumps whose
changelog lists changed components used by Memorize.
