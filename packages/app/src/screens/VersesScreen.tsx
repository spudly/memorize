import { FlatList } from "react-native";
import { XStack } from "tamagui";
import { Badge, Button, Card, EmptyState, Text } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";

interface Props {
  store: MemorizeStore;
  onDrill(id: string): void;
}

export default function VersesScreen({ store, onDrill }: Props) {
  const { verses } = store.getState().data;

  if (verses.length === 0) {
    return (
      <>
        <Text variant="heading">My verses</Text>
        <EmptyState title="No verses yet" body="Find one in the Search tab to get started." />
      </>
    );
  }

  return (
    <>
      <Text variant="heading">My verses</Text>
      <FlatList
        style={{ flex: 1 }}
        data={verses}
        keyExtractor={(v) => v.verse.id}
        renderItem={({ item }) => (
          <Card marginBottom="$2">
            <Text variant="subheading">{item.verse.reference}</Text>
            <Badge tone={item.status === "memorized" ? "success" : "info"}>{item.status}</Badge>
            <Text variant="verse">{item.verse.text}</Text>
            {item.nextReviewAt && (
              <Text variant="hint">
                Next review: {new Date(item.nextReviewAt).toLocaleDateString()}
              </Text>
            )}
            <XStack gap="$2" marginTop="$2">
              <Button size="sm" onPress={() => onDrill(item.verse.id)}>
                Drill
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => store.actions.removeVerse(item.verse.id)}
              >
                Remove
              </Button>
            </XStack>
          </Card>
        )}
      />
    </>
  );
}
