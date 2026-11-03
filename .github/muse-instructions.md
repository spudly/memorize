# Copilot instructions — memorize

Review pull requests against these repository conventions. Flag violations
of the rules below; do not flag the patterns they prescribe.

## TypeScript

- Use type aliases (`type X = ...`), never `interface`. Do not suggest
  converting a type alias to an interface.

## Dependencies and the lockfile

- `package-lock.json` is never hand-edited. It is regenerated with the
  pinned npm (the `packageManager` field in `package.json`, currently
  npm@10.9.4). Do not nitpick generated lockfile diffs; flag a lockfile
  change that looks hand-edited or inconsistent with `package.json`.

## Styling

- All styling lives in the `@spudly/ui` design system and is applied
  through semantic props. Flag Tailwind classes or `style` props added in
  app code.
- Do not suggest adding styling props to design-system components — they
  own their styles completely.

## Search identity (packages/core)

- Each chunk of a document is its own memorizable item with persisted
  source identity. Flag changes that collapse chunks into a single item,
  and changes that match or reuse cards across different chunks.
  Snippet-to-full-text matching must stay within the same chunk.

## Accessibility and data states

- New interactive elements need an accessible name/label; icon-only
  controls must be labeled.
- New data surfaces need explicit error and empty states: no silent
  spinners, and no empty-result message shown when a load has failed.

## Tests and manual-test docs

- New behavior needs a regression test that fails without the change.
- Behavior changes should update the "Run when" triggers in
  `docs/manual-tests.md`.
