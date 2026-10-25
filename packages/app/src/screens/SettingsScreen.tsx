import { useState } from "react";
import { MemorizeSettingsPage } from "@spudly/ui/pages";
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
import { useDriveAuth } from "../driveAuth";
import { appStorage } from "../lib";

const localStore = new LocalStore(appStorage);

interface Props {
  store: MemorizeStore;
}

/**
 * Settings tab host (#127): the app keeps every piece of state
 * and business logic — the API-key input and store actions, the
 * Drive OAuth flow (useDriveAuth), and the sync/conflict
 * machinery — and hands display state to the DS
 * MemorizeSettingsPage, whose actions come back as bare
 * intents. The conflict choice crosses as the page's two named
 * callbacks and resolves here to the sync directions
 * ("push" = keep this device, "pull" = keep Drive). Store
 * readiness is gated in App, above this screen, so there is no
 * loading state here.
 */
export default function SettingsScreen({ store }: Props) {
  const { apiKey, data } = store.getState();
  const [keyInput, setKeyInput] = useState(apiKey ?? "");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const driveAuth = useDriveAuth();

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

  const driveClient = (): RestDriveClient => {
    const token = driveAuth.accessToken;
    if (!token) {
      throw new Error("Connect Google Drive first.");
    }
    return new RestDriveClient(() => Promise.resolve(token));
  };

  const runSync = async (): Promise<void> => {
    setBusy(true);
    setSyncMessage(null);
    setConflict(false);
    try {
      const drive = driveClient();
      const result: SyncResult = await syncWithDrive(localStore, drive, folderName);
      if (result.status === "conflict") {
        setConflict(true);
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
      const drive = driveClient();
      if (which === "push") {
        await forcePush(localStore, drive, folderName);
      } else {
        await forcePull(localStore, drive, folderName);
      }
      await refreshFromDisk();
      setConflict(false);
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
    <MemorizeSettingsPage
      apiKeyValue={keyInput}
      onApiKeyValueChange={setKeyInput}
      hasSavedApiKey={Boolean(apiKey)}
      onSaveApiKeyPress={saveKey}
      onClearApiKeyPress={clearKey}
      driveFolderName={folderName}
      driveConnected={Boolean(driveAuth.accessToken)}
      driveConnectReady={driveAuth.ready}
      isSyncing={busy}
      driveError={driveAuth.error}
      syncMessage={syncMessage}
      syncConflict={conflict}
      onConnectDrivePress={driveAuth.connect}
      onSyncDrivePress={() => void runSync()}
      onKeepDevicePress={() => void resolveConflict("push")}
      onKeepDrivePress={() => void resolveConflict("pull")}
    />
  );
}
