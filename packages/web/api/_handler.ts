/**
 * Same-origin proxy for the gospel-engine scripture API — shared handler.
 *
 * The API at https://engine.ibeco.me sends no CORS headers, so browsers block
 * the web app from calling it directly. This handler receives requests at
 * /api/* on the app's own origin and forwards them server-side, where CORS
 * does not apply. It runs in two places:
 *
 * - Production: the Vercel edge function in [...path].ts (same directory),
 *   which re-exports this handler.
 * - Local development: a dev-only Vite plugin in vite.config.ts, so
 *   `npm run dev` serves /api exactly like production instead of falling
 *   through to the SPA index.html.
 *
 * The API key comes from the GOSPEL_ENGINE_API_KEY environment variable (a
 * Vercel secret in production, packages/web/.env.local in development; never
 * shipped to the browser). When it is set, it always wins — any Authorization
 * header the client sent is ignored. When it is not set, the client's own
 * Authorization header is passed through instead. The key is never logged or
 * returned.
 *
 * This is deliberately not an open proxy: the upstream origin is hardcoded
 * and only the scripture endpoints below may be reached through it.
 */

const UPSTREAM_ORIGIN = "https://engine.ibeco.me";

const ALLOWED_ENDPOINTS = new Set(["search", "get", "list", "related", "citations"]);

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleGospelRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] !== "api" || segments[1] === undefined || !ALLOWED_ENDPOINTS.has(segments[1])) {
    return jsonError(404, "Not found");
  }
  if (request.method !== "GET") {
    return jsonError(405, "Method not allowed");
  }

  const headers = new Headers();
  const serverKey = process.env.GOSPEL_ENGINE_API_KEY;
  if (serverKey) {
    headers.set("authorization", `Bearer ${serverKey}`);
  } else {
    const authorization = request.headers.get("authorization");
    if (authorization) {
      headers.set("authorization", authorization);
    }
  }
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM_ORIGIN}${url.pathname}${url.search}`, {
      method: "GET",
      headers,
    });
  } catch {
    return jsonError(502, "Could not reach the scripture service");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
