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
 * rules. The key is read from GOSPEL_ENGINE_API_KEY — set it in
 * packages/web/.env.local (gitignored), mirroring the Vercel secret; with
 * no key set, the client's own Authorization header is passed through.
 */
function gospelApiDevProxy(): Plugin {
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
        const response = await handleGospelRequest(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(new Uint8Array(await response.arrayBuffer()));
      } catch {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Dev proxy error" }));
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
  // Bridge the key from .env.local into process.env for the shared handler,
  // the same way the Vercel env provides it in production. A key already in
  // the shell environment wins.
  const fileEnv = loadEnv(mode, process.cwd(), "GOSPEL_ENGINE_");
  if (!process.env.GOSPEL_ENGINE_API_KEY && fileEnv.GOSPEL_ENGINE_API_KEY) {
    process.env.GOSPEL_ENGINE_API_KEY = fileEnv.GOSPEL_ENGINE_API_KEY;
  }
  return {
    plugins: [react(), gospelApiDevProxy()],
    server: { port: 5173 },
    resolve: {
      // Keep workspace symlinks (node_modules/@memorize/* -> packages/*) intact
      // so the CommonJS transform applies to @memorize/core's dist output.
      preserveSymlinks: true,
    },
  };
});
