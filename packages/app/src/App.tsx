import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { TamaguiProvider } from "tamagui";
import { ScreenContainer, Spinner, Tabs, Text, baseTheme, createTamaguiConfig } from "@spudly/ui";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import Raleway from "../assets/fonts/Raleway.ttf";
import { appStorage, dataSourceFor } from "./lib";
import DrillScreen from "./screens/DrillScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SearchScreen from "./screens/SearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VersesScreen from "./screens/VersesScreen";

// @spudly/ui 1.x ships config factories only — the pre-built
// `tamaguiConfig` export was removed (a module-scope config from
// the package would silently take over every consumer's
// rendering). Create the app's config exactly once, here in
// app-owned module scope. baseTheme is what the removed default
// config was built from in 0.4.x, so the palette is unchanged;
// adopting memorizeTheme (Quiet Dawn) stays a deliberate one-line
// change, not a side effect of this bump.
const tamaguiConfig = createTamaguiConfig(baseTheme);

type Tab = "verses" | "search" | "review" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "verses", label: "Verses" },
  { value: "search", label: "Search" },
  { value: "review", label: "Review" },
  { value: "settings", label: "Settings" },
];

export default function App() {
  // @spudly/ui 1.4 makes Raleway the UI font in every theme; it is
  // not a stock font on any platform, so the app registers the
  // bundled variable font under the exact name "Raleway" (assets/
  // fonts/Raleway.ttf, SIL OFL — see the OFL.txt alongside it).
  const [fontsLoaded, fontError] = useFonts({ Raleway });
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

  // Hold the first render until the store is ready and Raleway is
  // registered, so text never flashes in the fallback stack. A font
  // load error must not brick the app: the DS tokens fall back to
  // the platform sans by design, so an error lets rendering proceed
  // unregistered.
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
