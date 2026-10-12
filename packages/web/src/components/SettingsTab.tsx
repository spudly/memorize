import { useState } from "react";
import {
  DEFAULT_SETTINGS,
  LocalStore,
  RestDriveClient,
  forcePull,
  forcePush,
  syncWithDrive,
  type MemorizeStore,
  type SyncResult,
} from "@memorize/core";
import { getDriveAccessToken } from "../lib/driveAuth";
import { webStorage } from "../lib/storage";

const localStore = new LocalStore(webStorage);

interface Props {
  store: MemorizeStore;
}

export default function SettingsTab({ store }: Props) {
  const { apiKey, data } = store.getState();
  const [keyInput, setKeyInput] = useState(apiKey ?? "");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ local: string | null; remote: string | null } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const folderName = data.settings.driveFolderName || DEFAULT_SETTINGS.driveFolderName;

  const saveKey = (): void => {
    const key = keyInput.trim();
    if (key) {
      void store.actions.setApiKey(key);
    }
  };

  const clearKey = (): void => {
    setKeyInput("");
    void store.actions.clearApiKey();
  };

  const refreshFromDisk = async (): Promise<void> => {
    const fresh = await localStore.loadData();
    if (fresh) {
      await store.actions.replaceAll(fresh);
    }
  };

  const driveClient = async (): Promise<RestDriveClient> => {
    const token = await getDriveAccessToken();
    return new RestDriveClient(() => Promise.resolve(token));
  };

  const runSync = async (): Promise<void> => {
    setBusy(true);
    setSyncMessage(null);
    setConflict(null);
    try {
      const drive = await driveClient();
      const result: SyncResult = await syncWithDrive(localStore, drive, folderName);
      if (result.status === "conflict") {
        setConflict({
          local: result.localUpdatedAt ?? null,
          remote: result.remoteUpdatedAt ?? null,
        });
        setSyncMessage(
          "Both this device and Drive changed since the last sync. Choose which side wins.",
        );
      } else {
        await refreshFromDisk();
        setSyncMessage(`Sync ${result.status}.`);
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const resolveConflict = async (which: "push" | "pull"): Promise<void> => {
    setBusy(true);
    try {
      const drive = await driveClient();
      if (which === "push") {
        await forcePush(localStore, drive, folderName);
      } else {
        await forcePull(localStore, drive, folderName);
      }
      await refreshFromDisk();
      setConflict(null);
      setSyncMessage(
        `Conflict resolved (${which === "push" ? "kept this device" : "kept Drive"}).`,
      );
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2>Settings</h2>

      <h3>Scripture source</h3>
      <p className="hint">
        A gospel-engine API key unlocks full-library search. The key stays on this device and is
        never synced.{" "}
        <a href="https://engine.ibeco.me/keys" target="_blank" rel="noreferrer">
          Get a key
        </a>
      </p>
      <div className="row">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="gospel-engine API key"
        />
        <button onClick={saveKey} disabled={!keyInput.trim()}>
          Save
        </button>
        {apiKey && <button onClick={clearKey}>Clear</button>}
      </div>

      <h3>Google Drive sync</h3>
      <p className="hint">
        Syncs your verse list (never your API key) to <code>memorize-data.json</code> in the “
        {folderName}” Drive folder. Requires a Google OAuth client ID — see the README.
      </p>
      <button onClick={() => void runSync()} disabled={busy}>
        Sync with Drive
      </button>
      {syncMessage && <p className="hint">{syncMessage}</p>}
      {conflict && (
        <div className="row">
          <button onClick={() => void resolveConflict("push")} disabled={busy}>
            Keep this device
          </button>
          <button onClick={() => void resolveConflict("pull")} disabled={busy}>
            Keep Drive
          </button>
        </div>
      )}
    </section>
  );
}
