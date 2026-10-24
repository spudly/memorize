# Memorize

A scripture memorization app — web and mobile, **no backend server**. Search
for verses, drill them with a progressive word-blanking memorizer, and review
them on a spaced-repetition schedule (daily for a week, weekly for a month,
monthly for a year, then annually). Everything is stored locally on the
device, with optional sync to a file in your own Google Drive.

## Features

- **Search & select verses** from the [gospel-engine](https://engine.ibeco.me)
  API (scriptures, conference talks, manuals, study aids). Without an API key
  the app falls back to a small built-in set of demo verses and works fully
  offline.
- **Memorization drill** — each round blanks out more of the verse (20% →
  95%). Tap a blank to peek; pass a round with few peeks to advance.
- **Tracking** — verses move from _learning_ to _memorized_; the home screen
  shows what's due for review today.
- **Spaced review** — after a verse is memorized: daily × 7, weekly × 4,
  monthly × 12, then yearly. Forgetting a verse restarts it at daily.
- **Google Drive sync** — one JSON file (`Memorize/memorize-data.json`) in
  your Drive; bring your own Google OAuth client (below). Your API key is
  stored locally only and is never synced.

## Stack

TypeScript monorepo (npm workspaces + Turborepo), mirroring the conventions
of the Eciperay project:

| Package          | What it is                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| `packages/types` | Shared types (`Verse`, `MemorizedVerse`, `AppData`, settings)                    |
| `packages/core`  | Scripture API client, spaced-repetition engine, drill logic, storage, Drive sync |
| `packages/web`   | Web app — Vite + React + React Router + Tailwind                                 |
| `packages/app`   | Mobile app — Expo + React Native + React Navigation                              |

## Getting started

Prerequisites: Node 22+ (see `.nvmrc`).

```sh
npm install
npm run dev:web        # web app (Vite dev server)
npm run start --workspace=@memorize/app   # mobile app (Expo — scan with Expo Go)
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run build`.

## Scripture API key

The full library comes from the community gospel-engine service (there is no
official Church API). To get a key:

1. Go to <https://engine.ibeco.me/keys> and sign in with Google.
2. Create a key (it looks like `stdy_…`).
3. In the app, open **Settings** and paste it in.

The API's response shapes were mapped defensively in
`packages/core/src/scripture.ts`; `packages/core/docs/api-notes.md` has curl
commands to verify the field mapping against a live response.

> **Note (web):** the API sends no CORS headers, so a browser can't call it
> directly. On mobile this doesn't apply. For the web app, deploy to Vercel
> (below) — its edge proxy solves this — or use the demo data locally.

## Google Drive sync setup

Sync is optional and talks to Drive directly from the app (no server). It
needs your own Google Cloud OAuth client:

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project and enable the **Google Drive API**.
2. Create an OAuth client ID of type **Web application**; add your app's
   origin under _Authorized JavaScript origins_.
3. Web: copy `packages/web/.env.example` to `packages/web/.env` and set
   `VITE_GOOGLE_CLIENT_ID`.
4. Mobile: put the client configuration in `packages/app/app.json` under
   `extra` (see the Expo AuthSession docs for the Android/iOS client IDs).

The sync uses the `drive.file` scope — the app can only see files it created.
Conflicts are last-write-wins by the data's `updatedAt` timestamp, with an
explicit conflict state rather than a silent overwrite.

## Data model

One `AppData` object (version 1) holds everything: the verse list (each with
status, drill progress, review count, and next-review date) and non-secret
settings. It is what gets stored locally and synced to Drive. The review
intervals in days are `[1×7, 7×4, 30×12, 365…]`, computed in
`packages/core/src/schedule.ts`.

## A note on the content

Scripture text is © by The Church of Jesus Christ of Latter-day Saints. This
app is for personal study; displaying Church content to other users in a
published app requires the Church's written permission — see
<https://permissions.lds.org>.

## Deploying the web app (Vercel)

The web app (`packages/web`) deploys to Vercel as a static Vite site plus one
edge function:

1. In Vercel, choose **Add New → Project** and import the `spudly/memorize`
   repository.
2. Set **Root Directory** to `packages/web`.
3. Add the API key as a server secret: **Settings → Environment Variables** →
   add `GOSPEL_ENGINE_API_KEY` with your gospel-engine key, for both
   **Production** and **Preview**.
4. Nothing else to configure — the framework preset, install/build commands,
   output directory, and environment all come from `packages/web/vercel.json`.

### Why the edge proxy exists

The gospel-engine API (`https://engine.ibeco.me`) sends no CORS headers, so a
browser blocks the web app from calling it directly. The edge function in
`packages/web/api` receives requests at `/api/*` on the app's own origin and
forwards them to the API server-side, where CORS does not apply. Only the
scripture endpoints (`search`, `get`, `list`, `related`, `citations`) can be
reached through it, and the upstream origin is hardcoded — it is not an open
proxy. It injects the API key from the `GOSPEL_ENGINE_API_KEY` secret, so the
deployed app needs no per-user key.

One trade-off to know about: the deployed proxy is reachable by anyone who
has the site URL, so visitors effectively share your key. The exposure is
bounded — the endpoint allowlist limits what the key can be used for through
the proxy, and the key itself is rate-limited — but if you want the site
private, enable **Vercel password protection** (Deployment Protection) on the
project.

The proxy is switched on by `VITE_USE_GOSPEL_PROXY=1`, which `vercel.json`
sets for the Vercel build; with it set, the app calls `/api/*` on its own
origin instead of the API origin. The in-app Settings key field still exists
as a fallback — it is what non-Vercel hosting and local direct mode (below)
use.

### Local development

`npm run dev` serves `/api/*` too: a dev-only Vite plugin runs the same
shared proxy handler (`packages/web/api/_handler.ts`) that the edge function
uses in production, so local behavior matches the deployment — without it,
`/api` requests would fall through to the SPA fallback and return HTML.

To use it, create `packages/web/.env.local` (gitignored):

```sh
VITE_USE_GOSPEL_PROXY=1
GOSPEL_ENGINE_API_KEY=<your gospel-engine key>
```

The first line switches the app to proxy mode (the same flag `vercel.json`
sets for the Vercel build); the second is the key the dev proxy injects,
mirroring the Vercel secret. The key line is optional — without it, the key
from the app's Settings screen is passed through instead. Without the file
at all, local dev falls back to the direct API, which browser CORS blocks
for real-key search (demo data and the mobile app are unaffected).

One dev-server gotcha is handled automatically: Vite's dep-optimizer cache
(`node_modules/.vite`) does not notice when a linked workspace package's
dist changes, so after rebuilding `@memorize/core` / `@memorize/types` (or
switching branches) the client could keep running the old bundle. A
`predev` guard (`packages/web/scripts/clearStaleViteCache.mjs`)
fingerprints both dist trees and wipes the cache only when they changed.
If the client ever does serve stale workspace code, deleting
`node_modules/.vite` and restarting is the manual equivalent.
