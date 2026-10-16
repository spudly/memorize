/**
 * Vercel edge function for /api/* — the production gospel-engine proxy.
 * The implementation lives in _handler.ts, shared with the Vite dev plugin
 * in vite.config.ts so local development behaves identically.
 *
 * This must stay a request-only wrapper, NOT a direct re-export of
 * handleGospelRequest: Vercel invokes edge handlers with (request,
 * context), and handleGospelRequest's optional second parameter is the
 * server key — the platform context object would land in it and be sent
 * upstream as the bearer token, breaking authentication.
 */
import { handleGospelRequest } from "./_handler.js";

export const config = { runtime: "edge" };

export default function handler(request: Request): Promise<Response> {
  return handleGospelRequest(request);
}
