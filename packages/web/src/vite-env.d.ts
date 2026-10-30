/// <reference types="vite/client" />

// Vite's client types (import.meta.env and friends) are pulled in via this
// reference — scoped to the app sources in src/ — instead of a "types" entry
// in tsconfig.json. A tsconfig-level "types" entry applies to every program
// built from that config, including Vercel's separate compile of the api/
// edge functions, where the vite package is not resolvable and the build log
// showed error TS2688 (memorize #67).
