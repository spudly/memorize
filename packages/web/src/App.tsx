import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Spinner, TamaguiProvider, Text, XStack, YStack } from "tamagui";
import { Pressable } from "react-native";
import { ChunkErrorBoundary, memorizeTheme } from "@spudly/ui";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "verses", label: "My verses" },
  { id: "search", label: "Search" },
  { id: "review", label: "Review" },
  { id: "settings", label: "Settings" },
];

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

  const { apiKey } = store.getState();
  const dataSource = useMemo(() => dataSourceFor(apiKey), [apiKey]);

  const closeDrill = (): void => {
    setDrillingId(null);
    if (drillIdFromPath(window.location.pathname) !== null) {
      window.history.pushState({}, "", "/");
    }
  };

  const handleTabChange = (next: Tab): void => {
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

  return (
    <TamaguiProvider config={webTamaguiConfig} defaultTheme="light">
      <YStack flex={1} padding="$4" gap="$3" backgroundColor="$background">
        <Text fontSize="$8" fontWeight="700" color="$color">
          Memorize
        </Text>
        <XStack gap="$2" flexWrap="wrap" accessibilityRole="tablist" aria-label="Memorize sections">
          {TABS.map((t) => {
            const selected = !drillingId && tab === t.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                aria-selected={selected}
                onPress={() => handleTabChange(t.id)}
                style={{
                  backgroundColor: selected
                    ? memorizeTheme.semantic.primary
                    : memorizeTheme.semantic.surface,
                  borderColor: memorizeTheme.semantic.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text
                  color={selected ? memorizeTheme.semantic.onPrimary : memorizeTheme.semantic.text}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </XStack>
        <ChunkErrorBoundary key={drillingId ? "drill" : tab}>
          <Suspense
            fallback={
              <YStack alignItems="center" padding="$4">
                <Spinner size="large" accessibilityLabel="Loading" />
              </YStack>
            }
          >
            {drillingId ? (
              <DrillView store={store} verseId={drillingId} onBack={closeDrill} />
            ) : tab === "verses" ? (
              <VersesTab store={store} />
            ) : tab === "search" ? (
              <SearchTab
                store={store}
                dataSource={dataSource}
                usingDemo={isDemoDataSource(apiKey)}
              />
            ) : tab === "review" ? (
              <ReviewTab store={store} />
            ) : (
              <SettingsTab store={store} />
            )}
          </Suspense>
        </ChunkErrorBoundary>
      </YStack>
    </TamaguiProvider>
  );
}
