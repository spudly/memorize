import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { handleGospelRequest } from "./api/_handler.js";

/**
 * Dev/preview stand-in for the Vercel edge function in api/[...path].ts.
 * Without it, /api/* falls through to the SPA fallback and returns
 * index.html. It runs the same shared handler (api/_handler.ts) in-process,
 * so local behavior matches production: same endpoint allowlist, same key
 * rules. The server key is resolved once per config load (shell env first,
 * then packages/web/.env.local, mirroring the Vercel secret) and passed to
 * the handler explicitly — deliberately NOT written into process.env, so
 * editing .env.local and reloading the config can never leave a stale key
 * behind. With no key set, the client's own Authorization header is passed
 * through.
 */
function gospelApiDevProxy(serverKey: string | undefined): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const path = req.url?.split("?")[0] ?? "";
    if (path !== "/api" && !path.startsWith("/api/")) {
      next();
      return;
    }
    void (async () => {
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === "string") {
            headers.set(name, value);
          } else if (Array.isArray(value)) {
            headers.set(name, value.join(", "));
          }
        }
        const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? ""}`, {
          method: req.method ?? "GET",
          headers,
        });
        const response = await handleGospelRequest(request, serverKey);
        // Buffer the body before sending headers: if reading it failed,
        // headers would already be sent and the 500 below could not be
        // written (ERR_HTTP_HEADERS_SENT).
        const body = new Uint8Array(await response.arrayBuffer());
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(body);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Dev proxy error" }));
        }
      }
    })();
  };
  return {
    name: "gospel-api-dev-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Resolve the server key fresh on every config load: a key in the shell
  // environment wins over packages/web/.env.local. The value is handed to
  // the dev plugin (and from there to the shared handler) without touching
  // process.env, so reloads always see the current file contents.
  const fileEnv = loadEnv(mode, process.cwd(), "GOSPEL_ENGINE_");
  const gospelServerKey = process.env.GOSPEL_ENGINE_API_KEY ?? fileEnv.GOSPEL_ENGINE_API_KEY;
  return {
    plugins: [react(), gospelApiDevProxy(gospelServerKey)],
    build: {
      rolldownOptions: {
        output: {
          // Vendor splitting (memorize#54, Option B): keep the framework and
          // design-system runtime out of the app entry chunk so the entry
          // stays small and the vendor chunks cache across app releases.
          // Combined with the lazy tab surfaces in App.tsx, no single chunk
          // exceeds Vite's 500 kB warning threshold.
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 30,
              },
              {
                name: "vendor-ui",
                test: /node_modules[\\/](@spudly[\\/]ui|@tamagui|tamagui|react-native-web|@floating-ui|react-native-svg)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    server: { port: 5173 },
    resolve: {
      // Keep workspace symlinks (node_modules/@memorize/* -> packages/*) intact
      // so the CommonJS transform applies to @memorize/core's dist output.
      preserveSymlinks: true,
      alias: [
        // @spudly/ui's component graph pulls in react-native (via
        // react-native-svg and friends); on web it resolves to
        // react-native-web — the same substitution the design system's
        // web Storybook and the eciperay web build make. Exact-name
        // alias only: subpath imports (react-native/...) are not used
        // and must not be rewritten.
        { find: /^react-native$/, replacement: "react-native-web" },
      ],
    },
  };
});
