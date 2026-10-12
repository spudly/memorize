import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import { appStorage, dataSourceFor } from "./lib";
import DrillScreen from "./screens/DrillScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SearchScreen from "./screens/SearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VersesScreen from "./screens/VersesScreen";

type Tab = "verses" | "search" | "review" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "verses", label: "Verses" },
  { id: "search", label: "Search" },
  { id: "review", label: "Review" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const store: MemorizeStore = useMemo(() => createMemorizeStore(appStorage), []);
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("verses");
  const [drillingId, setDrillingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTick((t) => t + 1));
    void store.ready.then(() => setReady(true));
    return unsubscribe;
  }, [store]);

  const { apiKey } = store.getState();
  const dataSource = useMemo(() => dataSourceFor(apiKey), [apiKey]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Memorize</Text>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => {
              setTab(t.id);
              setDrillingId(null);
            }}
          >
            <Text style={tab === t.id ? styles.tabLabelActive : styles.tabLabel}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>
        {drillingId ? (
          <DrillScreen store={store} verseId={drillingId} onBack={() => setDrillingId(null)} />
        ) : tab === "verses" ? (
          <VersesScreen store={store} onDrill={setDrillingId} />
        ) : tab === "search" ? (
          <SearchScreen store={store} dataSource={dataSource} usingDemo={!apiKey} />
        ) : tab === "review" ? (
          <ReviewScreen store={store} />
        ) : (
          <SettingsScreen store={store} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  title: { fontSize: 24, fontWeight: "bold", paddingHorizontal: 16, paddingTop: 8 },
  tabBar: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eee",
  },
  tabActive: { backgroundColor: "#1a1a1a" },
  tabLabel: { color: "#1a1a1a" },
  tabLabelActive: { color: "#fff" },
  content: { flex: 1 },
});
