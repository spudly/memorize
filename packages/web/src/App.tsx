import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { TamaguiProvider } from "tamagui";
import { Tabs, Text, ScreenContainer, Spinner } from "@spudly/ui";
import { webTamaguiConfig } from "./tamaguiConfig";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import VersesTab from "./components/VersesTab";

// Code-split the non-initial surfaces (memorize#54, Option B): the verses tab
// is the landing view and stays in the initial chunk; drill, search, review
// and settings load on first navigation to them.
const DrillView = lazy(() => import("./components/DrillView"));
const ReviewTab = lazy(() => import("./components/ReviewTab"));
const SearchTab = lazy(() => import("./components/SearchTab"));
const SettingsTab = lazy(() => import("./components/SettingsTab"));
import { dataSourceFor, isDemoDataSource } from "./lib/gospel";
import { webStorage } from "./lib/storage";

type Tab = "verses" | "search" | "review" | "settings";

export default function App() {
  const store: MemorizeStore = useMemo(() => createMemorizeStore(webStorage), []);
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
      <TamaguiProvider config={webTamaguiConfig} defaultTheme="light">
        <ScreenContainer>
          <Spinner label="Loading Memorize" />
        </ScreenContainer>
      </TamaguiProvider>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "verses", label: "My verses" },
    { id: "search", label: "Search" },
    { id: "review", label: "Review" },
    { id: "settings", label: "Settings" },
  ];

  const handleTabChange = (value: string): void => {
    setTab(value as Tab);
    setDrillingId(null);
  };

  return (
    <TamaguiProvider config={webTamaguiConfig} defaultTheme="light">
      <ScreenContainer>
        <Text variant="heading">Memorize</Text>
        <Tabs
          tabs={tabs.map((t) => ({ value: t.id, label: t.label }))}
          value={tab}
          onValueChange={handleTabChange}
        />
        <Suspense fallback={<Spinner label="Loading" />}>
          {drillingId ? (
            <DrillView store={store} verseId={drillingId} onBack={() => setDrillingId(null)} />
          ) : tab === "verses" ? (
            <VersesTab store={store} onDrill={setDrillingId} />
          ) : tab === "search" ? (
            <SearchTab store={store} dataSource={dataSource} usingDemo={isDemoDataSource(apiKey)} />
          ) : tab === "review" ? (
            <ReviewTab store={store} />
          ) : (
            <SettingsTab store={store} />
          )}
        </Suspense>
      </ScreenContainer>
    </TamaguiProvider>
  );
}
