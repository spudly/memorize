import { useState } from "react";
import { XStack } from "tamagui";
import { Button, InlineAlert, SectionCard, Text, TextField } from "@spudly/ui";
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
    <>
      <Text variant="heading">Settings</Text>

      <SectionCard title="Scripture source">
        <Text variant="hint">
          A gospel-engine API key unlocks full-library search. The key stays on this device and is
          never synced.
        </Text>
        <TextField
          label="API key"
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="gospel-engine API key"
          secureTextEntry
          autoCapitalize="none"
        />
        <XStack gap="$2">
          <Button size="sm" onPress={saveKey} disabled={!keyInput.trim()}>
            Save key
          </Button>
          {apiKey && (
            <Button size="sm" variant="secondary" onPress={clearKey}>
              Clear key
            </Button>
          )}
        </XStack>
      </SectionCard>

      <SectionCard title="Google Drive sync">
        <Text variant="hint">
          Syncs your verse list (never your API key) to memorize-data.json in the “{folderName}”
          Drive folder.
        </Text>
        {!driveAuth.accessToken ? (
          <Button onPress={driveAuth.connect} disabled={!driveAuth.ready || busy}>
            Connect Google Drive
          </Button>
        ) : (
          <Button onPress={() => void runSync()} disabled={busy}>
            Sync with Drive
          </Button>
        )}
        {driveAuth.error && <InlineAlert severity="error">{driveAuth.error}</InlineAlert>}
        {syncMessage && (
          <InlineAlert severity={conflict ? "warning" : "info"}>{syncMessage}</InlineAlert>
        )}
        {conflict && (
          <XStack gap="$2">
            <Button size="sm" onPress={() => void resolveConflict("push")} disabled={busy}>
              Keep this device
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void resolveConflict("pull")}
              disabled={busy}
            >
              Keep Drive
            </Button>
          </XStack>
        )}
      </SectionCard>
    </>
  );
}
