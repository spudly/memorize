import { FlatList } from "react-native";
import { XStack } from "tamagui";
import { Button, Card, EmptyState, Text } from "@spudly/ui";
import { dueVerses, type MemorizeStore, type ReviewOutcome } from "@memorize/core";

interface Props {
  store: MemorizeStore;
}

export default function ReviewScreen({ store }: Props) {
  const due = dueVerses(store.getState().data.verses, new Date());

  const review = (id: string, outcome: ReviewOutcome): void => {
    store.actions.recordReview(id, outcome);
  };

  if (due.length === 0) {
    return (
      <>
        <Text variant="heading">Review</Text>
        <EmptyState title="Nothing due" body="Nice work." />
      </>
    );
  }

  return (
    <>
      <Text variant="heading">Review ({due.length} due)</Text>
      <FlatList
        style={{ flex: 1 }}
        data={due}
        keyExtractor={(v) => v.verse.id}
        renderItem={({ item }) => (
          <Card marginBottom="$2">
            <Text variant="subheading">{item.verse.reference}</Text>
            <Text variant="verse">{item.verse.text}</Text>
            <XStack gap="$2" marginTop="$2">
              <Button size="sm" onPress={() => review(item.verse.id, "remembered")}>
                I remembered it
              </Button>
              <Button size="sm" variant="secondary" onPress={() => review(item.verse.id, "forgot")}>
                I forgot it
              </Button>
            </XStack>
          </Card>
        )}
      />
    </>
  );
}
