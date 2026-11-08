import "./locales/polyfills";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Raleway from "../assets/fonts/Raleway.ttf";
import Alegreya from "../assets/fonts/Alegreya.ttf";
import { Spinner, TamaguiProvider, Text, XStack, YStack } from "tamagui";
import { memorizeTheme } from "@spudly/ui";
import { appTamaguiConfig } from "./tamaguiConfig";
import { createMemorizeStore, type MemorizeStore } from "@memorize/core";
import { appStorage, dataSourceFor } from "./lib";
import { I18nProvider } from "@lingui/react";
import { getLocales } from "expo-localization";
import { activateForDevice, i18n, LOCALE_STORAGE_KEY } from "./locales/i18n";
import DrillScreen from "./screens/DrillScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SearchScreen from "./screens/SearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VersesScreen from "./screens/VersesScreen";

type Tab = "verses" | "search" | "review" | "settings";

const TABS: { value: Tab; label: () => string }[] = [
  { value: "verses", label: () => i18n._({ id: "tab.verses", message: "Verses" }) },
  { value: "search", label: () => i18n._({ id: "tab.search", message: "Search" }) },
  { value: "review", label: () => i18n._({ id: "tab.review", message: "Review" }) },
  { value: "settings", label: () => i18n._({ id: "tab.settings", message: "Settings" }) },
];

/**
 * The canonical drill destination on native (DS #425):
 * `memorize://drill/<id>`. MyVersesPage rows link here (the DS
 * Button href form opens the href through the platform link
 * path); the host handles the deep link and opens the drill
 * screen for that verse. Returns null for every other URL.
 */
function drillIdFromUrl(url: string): string | null {
  const match = /^memorize:\/\/drill\/([^/?#]+)\/?$/.exec(url);
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
  const [localeReady, setLocaleReady] = useState(false);
  const [tab, setTab] = useState<Tab>("verses");
  const [drillingId, setDrillingId] = useState<string | null>(null);

  // Locale activation (#110): stored choice (AsyncStorage) >
  // device locales (expo-localization) > en-US. Rendering gates on
  // it below so the first paint is already localized.
  useEffect(() => {
    void (async () => {
      try {
        let stored: string | null = null;
        try {
          stored = await appStorage.getItem(LOCALE_STORAGE_KEY);
        } catch {
          // A failed stored-choice read must not skip device-locale
          // negotiation — fall through with no stored choice.
        }
        await activateForDevice({
          stored,
          deviceLocales: getLocales().map((locale) => locale.languageTag),
        });
      } catch {
        // A failed locale read/activation must not hang the app on
        // the loading gate: the singleton is already activated with
        // the en-US default, so fall through and render with it.
      } finally {
        setLocaleReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTick((t) => t + 1));
    void store.ready.then(() => setReady(true));
    return unsubscribe;
  }, [store]);

  // Canonical drill deep links: cold start (initial URL) and
  // warm opens (URL events) both land on the verse's drill.
  useEffect(() => {
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (!cancelled && url) {
        const id = drillIdFromUrl(url);
        if (id) {
          setDrillingId(id);
        }
      }
    });
    const subscription = Linking.addEventListener("url", (event) => {
      const id = drillIdFromUrl(event.url);
      if (id) {
        setDrillingId(id);
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const dataSource = useMemo(() => dataSourceFor(), []);

  if (!ready || !fontsLoaded || !localeReady) {
    return (
      <I18nProvider i18n={i18n}>
        <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
          <SafeAreaView style={{ flex: 1 }}>
            <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
              <Spinner size="large" />
            </YStack>
          </SafeAreaView>
        </TamaguiProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider i18n={i18n}>
      <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <YStack flex={1} padding="$4" gap="$3" backgroundColor="$background">
            <Text fontSize="$8" fontWeight="700" color="$color">
              {i18n._({ id: "app.title", message: "Memorize" })}
            </Text>
            <XStack
              gap="$2"
              flexWrap="wrap"
              accessibilityRole="tablist"
              aria-label={i18n._({ id: "app.tabsLabel", message: "Memorize sections" })}
            >
              {TABS.map((t) => {
                const selected = !drillingId && tab === t.value;
                return (
                  <Pressable
                    key={t.value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    aria-selected={selected}
                    onPress={() => {
                      setTab(t.value);
                      setDrillingId(null);
                    }}
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
                      color={
                        selected ? memorizeTheme.semantic.onPrimary : memorizeTheme.semantic.text
                      }
                    >
                      {t.label()}
                    </Text>
                  </Pressable>
                );
              })}
            </XStack>
            {drillingId ? (
              // Keyed by the verse id: a warm drill link for a different
              // verse must remount the screen, not carry the previous
              // verse's round/peeks state into the new verse's drill.
              <DrillScreen
                key={drillingId}
                store={store}
                verseId={drillingId}
                onBack={() => setDrillingId(null)}
              />
            ) : tab === "verses" ? (
              <VersesScreen store={store} />
            ) : tab === "search" ? (
              <SearchScreen store={store} dataSource={dataSource} usingDemo />
            ) : tab === "review" ? (
              <ReviewScreen store={store} />
            ) : (
              <SettingsScreen />
            )}
          </YStack>
        </SafeAreaView>
      </TamaguiProvider>
    </I18nProvider>
  );
}
