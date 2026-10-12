import { createEmptyAppData, type AppData } from "@memorize/types";
import { LocalStore } from "./storage";

/**
 * Google Drive sync with no backend server. The app talks to the Drive REST
 * API directly using an OAuth access token obtained on-device (Google Identity
 * Services on web, expo-auth-session on mobile) with the `drive.file` scope.
 */

export interface DriveFileMeta {
  id: string;
  modifiedTime: string;
}

export interface DriveClient {
  findFile(name: string, folderName: string): Promise<DriveFileMeta | null>;
  readFile(id: string): Promise<string>;
  writeFile(
    id: string | null,
    name: string,
    folderName: string,
    content: string,
  ): Promise<{ id: string }>;
}

export class DriveApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DriveApiError";
    this.status = status;
  }
}

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** DriveClient implemented against the public Drive v3 REST API. */
export class RestDriveClient implements DriveClient {
  constructor(private readonly getAccessToken: () => Promise<string>) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (error) {
      throw new DriveApiError(
        `Could not reach Google Drive: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    if (!res.ok) {
      throw new DriveApiError(`Google Drive request failed with status ${res.status}`, res.status);
    }
    return res;
  }

  private async ensureFolder(folderName: string): Promise<string> {
    const q =
      `mimeType='${FOLDER_MIME}' and name='${folderName.replace(/'/g, "\\'")}'` +
      ` and trashed=false`;
    const listUrl = `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`;
    const listRes = await this.request(listUrl, { headers: await this.authHeaders() });
    const listed = (await listRes.json()) as { files?: { id: string }[] };
    const existing = listed.files?.[0]?.id;
    if (existing) {
      return existing;
    }
    const createRes = await this.request(DRIVE_FILES_URL, {
      method: "POST",
      headers: { ...(await this.authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, mimeType: FOLDER_MIME }),
    });
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) {
      throw new DriveApiError("Could not create the Drive folder");
    }
    return created.id;
  }

  async findFile(name: string, folderName: string): Promise<DriveFileMeta | null> {
    const folderId = await this.ensureFolder(folderName);
    const q =
      `name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents` + ` and trashed=false`;
    const url =
      `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}` +
      `&fields=files(id,modifiedTime)&spaces=drive&orderBy=modifiedTime desc`;
    const res = await this.request(url, { headers: await this.authHeaders() });
    const data = (await res.json()) as { files?: DriveFileMeta[] };
    return data.files?.[0] ?? null;
  }

  async readFile(id: string): Promise<string> {
    const res = await this.request(`${DRIVE_FILES_URL}/${encodeURIComponent(id)}?alt=media`, {
      headers: await this.authHeaders(),
    });
    return res.text();
  }

  async writeFile(
    id: string | null,
    name: string,
    folderName: string,
    content: string,
  ): Promise<{ id: string }> {
    if (id) {
      await this.request(`${DRIVE_UPLOAD_URL}/${encodeURIComponent(id)}?uploadType=media`, {
        method: "PATCH",
        headers: {
          ...(await this.authHeaders()),
          "Content-Type": "application/json",
        },
        body: content,
      });
      return { id };
    }
    const folderId = await this.ensureFolder(folderName);
    const boundary = "memorize-multipart-boundary";
    const metadata = { name, mimeType: "application/json", parents: [folderId] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${content}\r\n--${boundary}--`;
    const res = await this.request(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: "POST",
      headers: {
        ...(await this.authHeaders()),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const created = (await res.json()) as { id?: string };
    if (!created.id) {
      throw new DriveApiError("Could not create the Drive file");
    }
    return { id: created.id };
  }
}

export const DEFAULT_FILE_NAME = "memorize-data.json";

export type SyncStatus = "up-to-date" | "pushed" | "pulled" | "conflict";

export interface SyncResult {
  status: SyncStatus;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
}

export interface SyncOptions {
  fileName?: string;
}

/**
 * Build the exact JSON payload written to Drive. The gospel-engine API key is
 * local-only and is never included — this function reconstructs the payload
 * field-by-field so a stray key can never leak through.
 */
export function buildDrivePayload(data: AppData): string {
  const payload: AppData = {
    version: data.version,
    verses: data.verses,
    settings: {
      gospelEngineBaseUrl: data.settings.gospelEngineBaseUrl,
      driveFolderName: data.settings.driveFolderName,
    },
    updatedAt: data.updatedAt,
  };
  return JSON.stringify(payload);
}

function parseAppData(raw: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DriveApiError("The Drive data file is not valid JSON");
  }
  const obj =
    typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  if (!obj || obj["version"] !== 1 || !Array.isArray(obj["verses"])) {
    throw new DriveApiError("The Drive data file has an unexpected shape");
  }
  return parsed as AppData;
}

/**
 * Sync local data with the Drive file.
 *
 * - No remote file -> push local.
 * - No local data -> pull remote.
 * - Both changed since the last sync -> `conflict` (nothing is overwritten;
 *   resolve with {@link forcePush} / {@link forcePull}).
 * - Otherwise the newer side wins.
 */
export async function syncWithDrive(
  store: LocalStore,
  drive: DriveClient,
  folderName: string,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const fileName = opts.fileName ?? DEFAULT_FILE_NAME;
  const nowIso = new Date().toISOString();

  const localData = await store.loadData();
  const remoteMeta = await drive.findFile(fileName, folderName);
  const remoteData = remoteMeta ? parseAppData(await drive.readFile(remoteMeta.id)) : null;

  if (localData === null && remoteData === null) {
    await store.saveData(createEmptyAppData());
    return { status: "up-to-date" };
  }

  if (localData === null || remoteData === null) {
    if (localData !== null) {
      await drive.writeFile(null, fileName, folderName, buildDrivePayload(localData));
      await store.setLastSyncedAt(nowIso);
      return { status: "pushed", localUpdatedAt: localData.updatedAt };
    }
    const remote = remoteData as AppData;
    await store.saveData(remote);
    await store.setLastSyncedAt(nowIso);
    return { status: "pulled", remoteUpdatedAt: remote.updatedAt };
  }

  const local: AppData = localData;
  const remote: AppData = remoteData;

  if (local.updatedAt === remote.updatedAt) {
    return {
      status: "up-to-date",
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
    };
  }

  const lastSyncedAt = await store.getLastSyncedAt();
  const localChanged = lastSyncedAt !== null && local.updatedAt > lastSyncedAt;
  const remoteChanged = lastSyncedAt !== null && remote.updatedAt > lastSyncedAt;
  if (localChanged && remoteChanged) {
    return {
      status: "conflict",
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
    };
  }

  if (remote.updatedAt > local.updatedAt) {
    await store.saveData(remote);
    await store.setLastSyncedAt(nowIso);
    return {
      status: "pulled",
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
    };
  }

  await drive.writeFile(remoteMeta?.id ?? null, fileName, folderName, buildDrivePayload(local));
  await store.setLastSyncedAt(nowIso);
  return {
    status: "pushed",
    localUpdatedAt: local.updatedAt,
    remoteUpdatedAt: remote.updatedAt,
  };
}

/** Resolve a conflict by overwriting Drive with local data. */
export async function forcePush(
  store: LocalStore,
  drive: DriveClient,
  folderName: string,
  opts: SyncOptions = {},
): Promise<void> {
  const fileName = opts.fileName ?? DEFAULT_FILE_NAME;
  const local = (await store.loadData()) ?? createEmptyAppData();
  const remoteMeta = await drive.findFile(fileName, folderName);
  await drive.writeFile(remoteMeta?.id ?? null, fileName, folderName, buildDrivePayload(local));
  await store.setLastSyncedAt(new Date().toISOString());
}

/** Resolve a conflict by overwriting local data with Drive's copy. */
export async function forcePull(
  store: LocalStore,
  drive: DriveClient,
  folderName: string,
  opts: SyncOptions = {},
): Promise<void> {
  const fileName = opts.fileName ?? DEFAULT_FILE_NAME;
  const remoteMeta = await drive.findFile(fileName, folderName);
  if (!remoteMeta) {
    return;
  }
  const remote = parseAppData(await drive.readFile(remoteMeta.id));
  await store.saveData(remote);
  await store.setLastSyncedAt(new Date().toISOString());
}
