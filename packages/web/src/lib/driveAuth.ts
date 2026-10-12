/**
 * Google Drive OAuth for the web app, via Google Identity Services (GIS).
 * Requests the `drive.file` scope: the app only ever sees files it created.
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface TokenSuccess {
  access_token: string;
  expires_in: number;
}

interface TokenFailure {
  error: string;
}

type TokenResponse = TokenSuccess | TokenFailure;

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts) {
    return Promise.resolve();
  }
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Google Identity Services"));
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get a fresh Drive access token, prompting the user via GIS when needed. */
export async function getDriveAccessToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not set. See packages/web/.env.example.");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  await loadGis();
  const accounts = window.google?.accounts;
  if (!accounts) {
    throw new Error("Google Identity Services failed to load");
  }
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    try {
      const client = accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (r) => resolve(r),
      });
      client.requestAccessToken({ prompt: "" });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Google sign-in failed"));
    }
  });
  if (!("access_token" in response)) {
    throw new Error(`Google sign-in failed: ${response.error}`);
  }
  cachedToken = {
    token: response.access_token,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
  return response.access_token;
}
