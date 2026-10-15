import { useEffect, useMemo, useState } from "react";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig, Tabs, Text, ScreenContainer, Spinner } from "@spudly/ui";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import DrillView from "./components/DrillView";
import ReviewTab from "./components/ReviewTab";
import SearchTab from "./components/SearchTab";
import SettingsTab from "./components/SettingsTab";
import VersesTab from "./components/VersesTab";
import { dataSourceFor } from "./lib/gospel";
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
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
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
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ScreenContainer>
        <Text variant="heading">Memorize</Text>
        <Tabs
          tabs={tabs.map((t) => ({ value: t.id, label: t.label }))}
          value={tab}
          onValueChange={handleTabChange}
        />
        {drillingId ? (
          <DrillView store={store} verseId={drillingId} onBack={() => setDrillingId(null)} />
        ) : tab === "verses" ? (
          <VersesTab store={store} onDrill={setDrillingId} />
        ) : tab === "search" ? (
          <SearchTab store={store} dataSource={dataSource} usingDemo={!apiKey} />
        ) : tab === "review" ? (
          <ReviewTab store={store} />
        ) : (
          <SettingsTab store={store} />
        )}
      </ScreenContainer>
    </TamaguiProvider>
  );
}
