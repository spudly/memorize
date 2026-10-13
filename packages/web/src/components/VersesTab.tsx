import { Badge, Button, Card, EmptyState, Text } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";

interface Props {
  store: MemorizeStore;
  onDrill(id: string): void;
}

export default function VersesTab({ store, onDrill }: Props) {
  const { verses } = store.getState().data;

  if (verses.length === 0) {
    return (
      <>
        <Text variant="subheading">My verses</Text>
        <EmptyState title="No verses yet" body="Find one in the Search tab to get started." />
      </>
    );
  }

  return (
    <>
      <Text variant="subheading">My verses</Text>
      {verses.map((v) => (
        <Card key={v.verse.id}>
          <Text variant="body">{v.verse.reference}</Text>{" "}
          <Badge tone={v.status === "memorized" ? "success" : "info"}>{v.status}</Badge>
          <Text variant="verse">{v.verse.text}</Text>
          <Text variant="hint">
            {v.nextReviewAt
              ? `Next review: ${new Date(v.nextReviewAt).toLocaleDateString()}`
              : "Not scheduled"}
          </Text>
          <Button size="sm" onPress={() => onDrill(v.verse.id)}>
            Drill
          </Button>{" "}
          <Button
            size="sm"
            variant="secondary"
            onPress={() => store.actions.removeVerse(v.verse.id)}
          >
            Remove
          </Button>
        </Card>
      ))}
    </>
  );
}
