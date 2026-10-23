import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import ralewayVariableFont from "../assets/fonts/Raleway.ttf";
import { TamaguiProvider } from "tamagui";
import {
  createTamaguiConfig,
  memorizeTheme,
  ScreenContainer,
  Spinner,
  Tabs,
  Text,
} from "@spudly/ui";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import { appStorage, dataSourceFor } from "./lib";
import DrillScreen from "./screens/DrillScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SearchScreen from "./screens/SearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VersesScreen from "./screens/VersesScreen";

// @spudly/ui 1.x exports no pre-built Tamagui config: a config
// created at module scope inside the package would install itself
// as Tamagui's global singleton for every consumer (the
// spudly/eciperay#149 cross-brand theming bug). Each app creates
// its own exactly once, in app-owned code — Memorize's from the
// DS memorizeTheme (Quiet Dawn).
const tamaguiConfig = createTamaguiConfig(memorizeTheme);

type Tab = "verses" | "search" | "review" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "verses", label: "Verses" },
  { value: "search", label: "Search" },
  { value: "review", label: "Review" },
  { value: "settings", label: "Settings" },
];

export default function App() {
  const store: MemorizeStore = useMemo(() => createMemorizeStore(appStorage), []);
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  // @spudly/ui 1.4.0 names "Raleway" as the native font family for
  // every theme (#65): the app bundles the Raleway variable font and
  // registers it under that exact name, so the DS weights resolve
  // numerically against the one family. A load failure must not brick
  // the app — the DS tokens fall back to the platform sans — so the
  // gate below waits for either success or error.
  const [fontsLoaded, fontError] = useFonts({ Raleway: ralewayVariableFont });
  const [tab, setTab] = useState<Tab>("verses");
  const [drillingId, setDrillingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTick((t) => t + 1));
    void store.ready.then(() => setReady(true));
    return unsubscribe;
  }, [store]);

  const { apiKey } = store.getState();
  const dataSource = useMemo(() => dataSourceFor(apiKey), [apiKey]);

  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SafeAreaView style={{ flex: 1 }}>
          <ScreenContainer>
            <Spinner />
          </ScreenContainer>
        </SafeAreaView>
      </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <ScreenContainer scrollable={false}>
          <Text variant="heading">Memorize</Text>
          <Tabs
            tabs={TABS}
            value={tab}
            onValueChange={(value: string) => {
              setTab(value as Tab);
              setDrillingId(null);
            }}
          />
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
        </ScreenContainer>
      </SafeAreaView>
    </TamaguiProvider>
  );
}
