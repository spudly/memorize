/**
 * Vercel edge function for /api/* — the production gospel-engine proxy.
 * The implementation lives in _handler.ts, shared with the Vite dev plugin
 * in vite.config.ts so local development behaves identically.
 */
import { handleGospelRequest } from "./_handler.js";

export const config = { runtime: "edge" };

export default handleGospelRequest;
