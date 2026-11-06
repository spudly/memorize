import { lazy, useEffect, useMemo, useState } from "react";
import { Spinner, TamaguiProvider, Text, YStack } from "tamagui";
import { TabbedShellPage, type TabbedShellPageTab } from "@spudly/ui";
import { webTamaguiConfig } from "./tamaguiConfig";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import VersesTab from "./components/VersesTab";

// Code-split the non-initial surfaces (memorize#54, Option B): the verses tab
// is the landing view and stays in the initial chunk; drill, search, review
// and settings load on first navigation to them. The lazy components are
// passed into TabbedShellPage as tab content / the drill override; the
// frame's internal LazySlot wraps them with its chunk-error boundary
// and Suspense, so this host never imports the boundary (memorize#100).
const DrillView = lazy(() => import("./components/DrillView"));
const ReviewTab = lazy(() => import("./components/ReviewTab"));
const SearchTab = lazy(() => import("./components/SearchTab"));
const SettingsTab = lazy(() => import("./components/SettingsTab"));
import { dataSourceFor, isDemoDataSource } from "./lib/gospel";
import { webStorage } from "./lib/storage";

type Tab = "verses" | "search" | "review" | "settings";

const TAB_IDS: Tab[] = ["verses", "search", "review", "settings"];

function isTab(value: string): value is Tab {
  return (TAB_IDS as string[]).includes(value);
}

/**
 * The canonical drill destination on web (DS #425): `/drill/:id`.
 * MyVersesPage rows link here; the host parses the path on load
 * (and on history navigation) and opens the drill session for
 * that verse. Returns null for every other path.
 */
function drillIdFromPath(pathname: string): string | null {
  const match = /^\/drill\/([^/]+)\/?$/.exec(pathname);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export default function App() {
  const store: MemorizeStore = useMemo(() => createMemorizeStore(webStorage), []);
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("verses");
  const [drillingId, setDrillingId] = useState<string | null>(() =>
    drillIdFromPath(window.location.pathname),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTick((t) => t + 1));
    void store.ready.then(() => setReady(true));
    return unsubscribe;
  }, [store]);

  // Keep the open drill in sync with the URL: a Drill link is a
  // real navigation to /drill/:id, and Back/Forward move through
  // it like any other route.
  useEffect(() => {
    const onPopState = (): void => {
      setDrillingId(drillIdFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const dataSource = useMemo(() => dataSourceFor(), []);

  const closeDrill = (): void => {
    setDrillingId(null);
    if (drillIdFromPath(window.location.pathname) !== null) {
      window.history.pushState({}, "", "/");
    }
  };

  const handleTabChange = (next: string): void => {
    if (!isTab(next)) {
      return;
    }
    setTab(next);
    closeDrill();
  };

  if (!ready) {
    return (
      <TamaguiProvider config={webTamaguiConfig} defaultTheme="light">
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$4">
          <Spinner size="large" accessibilityLabel="Loading Memorize" />
          <Text>Loading Memorize</Text>
        </YStack>
      </TamaguiProvider>
    );
  }

  const tabs: TabbedShellPageTab[] = [
    { id: "verses", label: "My verses", content: <VersesTab store={store} /> },
    {
      id: "search",
      label: "Search",
      content: <SearchTab store={store} dataSource={dataSource} usingDemo={isDemoDataSource()} />,
    },
    { id: "review", label: "Review", content: <ReviewTab store={store} /> },
    { id: "settings", label: "Settings", content: <SettingsTab /> },
  ];

  return (
    <TamaguiProvider config={webTamaguiConfig} defaultTheme="light">
      <TabbedShellPage
        title="Memorize"
        tabsLabel="Memorize sections"
        tabs={tabs}
        activeTabId={drillingId ? null : tab}
        onTabSelect={handleTabChange}
      >
        {drillingId ? (
          <DrillView store={store} verseId={drillingId} onBack={closeDrill} />
        ) : undefined}
      </TabbedShellPage>
    </TamaguiProvider>
  );
}
