import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { DRIVE_SCOPE } from "./lib";

/**
 * Google Drive OAuth for the mobile app via expo-auth-session (PKCE code
 * flow). Requests the `drive.file` scope: the app only ever sees files it
 * created.
 *
 * Configure the client ID in app.json (`extra.googleAndroidClientId` /
 * `extra.googleIosClientId`) — see the README.
 */

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

function clientIdForPlatform(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    googleAndroidClientId?: string;
    googleIosClientId?: string;
  };
  return extra.googleAndroidClientId ?? extra.googleIosClientId ?? "";
}

export function useDriveAuth(): {
  accessToken: string | null;
  error: string | null;
  ready: boolean;
  connect(): void;
} {
  const clientId = clientIdForPlatform();
  const redirectUri = makeRedirectUri({ scheme: "memorize" });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId, scopes: [DRIVE_SCOPE], redirectUri },
    discovery,
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type !== "success") {
      if (response?.type === "error") {
        setError("Google sign-in failed");
      }
      return;
    }
    const code = response.params.code;
    const codeVerifier = request?.codeVerifier;
    if (!code || !codeVerifier) {
      setError("Google sign-in returned no auth code");
      return;
    }
    exchangeCodeAsync(
      { clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } },
      discovery,
    )
      .then((token) => setAccessToken(token.accessToken))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Token exchange failed"));
  }, [response, request, clientId, redirectUri]);

  return {
    accessToken,
    error,
    ready: !!request,
    connect: () => {
      void promptAsync();
    },
  };
}
