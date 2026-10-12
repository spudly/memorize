import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      <Text style={styles.subheading}>Scripture source</Text>
      <Text style={styles.hint}>
        A gospel-engine API key unlocks full-library search. The key stays on this device and is
        never synced.
      </Text>
      <TextInput
        style={styles.input}
        value={keyInput}
        onChangeText={setKeyInput}
        placeholder="gospel-engine API key"
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <Button title="Save key" onPress={saveKey} disabled={!keyInput.trim()} />
        {apiKey && <Button title="Clear key" onPress={clearKey} />}
      </View>

      <Text style={styles.subheading}>Google Drive sync</Text>
      <Text style={styles.hint}>
        Syncs your verse list (never your API key) to memorize-data.json in the “{folderName}” Drive
        folder.
      </Text>
      {!driveAuth.accessToken ? (
        <Button
          title="Connect Google Drive"
          onPress={driveAuth.connect}
          disabled={!driveAuth.ready || busy}
        />
      ) : (
        <Button title="Sync with Drive" onPress={() => void runSync()} disabled={busy} />
      )}
      {driveAuth.error && <Text style={styles.error}>{driveAuth.error}</Text>}
      {syncMessage && <Text style={styles.hint}>{syncMessage}</Text>}
      {conflict && (
        <View style={styles.row}>
          <Button
            title="Keep this device"
            onPress={() => void resolveConflict("push")}
            disabled={busy}
          />
          <Button title="Keep Drive" onPress={() => void resolveConflict("pull")} disabled={busy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  subheading: { fontSize: 16, fontWeight: "bold", marginTop: 16, marginBottom: 4 },
  hint: { color: "#666", fontSize: 13, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  error: { color: "#b00020", marginBottom: 8 },
});
