import { Pressable, StyleSheet } from "react-native";
import { Text } from "tamagui";
import { memorizeTheme } from "@spudly/ui";

import { i18n } from "../locales/i18n";

export type Tab = "verses" | "search" | "review" | "settings";

export const TABS: { value: Tab; label: () => string }[] = [
  { value: "verses", label: () => i18n._({ id: "tab.verses", message: "Verses" }) },
  { value: "search", label: () => i18n._({ id: "tab.search", message: "Search" }) },
  { value: "review", label: () => i18n._({ id: "tab.review", message: "Review" }) },
  { value: "settings", label: () => i18n._({ id: "tab.settings", message: "Settings" }) },
];

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const styles = StyleSheet.create({
  tab: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderColor: memorizeTheme.semantic.border,
  },
  tabSelected: { backgroundColor: memorizeTheme.semantic.primary },
  tabUnselected: { backgroundColor: memorizeTheme.semantic.surface },
});

/** One tab in the app shell's tab bar (extracted from App for max-lines). */
export default function TabButton({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      style={[styles.tab, selected ? styles.tabSelected : styles.tabUnselected]}
    >
      <Text color={selected ? memorizeTheme.semantic.onPrimary : memorizeTheme.semantic.text}>
        {label}
      </Text>
    </Pressable>
  );
}
