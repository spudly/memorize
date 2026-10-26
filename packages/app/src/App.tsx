import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Raleway from "../assets/fonts/Raleway.ttf";
import Alegreya from "../assets/fonts/Alegreya.ttf";
import { TamaguiProvider } from "tamagui";
import { ScreenContainer, Spinner, Tabs, Text } from "@spudly/ui";
import { appTamaguiConfig } from "./tamaguiConfig";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import { appStorage, dataSourceFor } from "./lib";
import DrillScreen from "./screens/DrillScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SearchScreen from "./screens/SearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VersesScreen from "./screens/VersesScreen";

type Tab = "verses" | "search" | "review" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "verses", label: "Verses" },
  { value: "search", label: "Search" },
  { value: "review", label: "Review" },
  { value: "settings", label: "Settings" },
];

export default function App() {
  // @spudly/ui names Raleway as the UI font for every theme
  // (design-system #65); it is not a stock font, so the app bundles
  // the variable font and registers it under the exact name
  // "Raleway" — numeric weights resolve against the one family.
  // The Quiet Dawn theme additionally names Alegreya for verse
  // text (design-system #66), bundled and registered the same
  // way under its exact name "Alegreya" (#127).
  const [fontsLoaded] = useFonts({ Raleway, Alegreya });
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

  if (!ready || !fontsLoaded) {
    return (
      <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
        <SafeAreaView style={{ flex: 1 }}>
          <ScreenContainer>
            <Spinner />
          </ScreenContainer>
        </SafeAreaView>
      </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
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
