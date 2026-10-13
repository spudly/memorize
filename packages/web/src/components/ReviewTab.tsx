import { Button, Card, EmptyState, Text } from "@spudly/ui";
import { dueVerses, type MemorizeStore, type ReviewOutcome } from "@memorize/core";

interface Props {
  store: MemorizeStore;
}

export default function ReviewTab({ store }: Props) {
  const due = dueVerses(store.getState().data.verses, new Date());

  const review = (id: string, outcome: ReviewOutcome): void => {
    store.actions.recordReview(id, outcome);
  };

  if (due.length === 0) {
    return (
      <>
        <Text variant="subheading">Review</Text>
        <EmptyState title="Nothing due" body="Nice work." />
      </>
    );
  }

  return (
    <>
      <Text variant="subheading">Review ({due.length} due)</Text>
      {due.map((v) => (
        <Card key={v.verse.id}>
          <Text variant="body">{v.verse.reference}</Text>
          <Text variant="verse">{v.verse.text}</Text>
          <Button size="sm" onPress={() => review(v.verse.id, "remembered")}>
            I remembered it
          </Button>{" "}
          <Button size="sm" variant="secondary" onPress={() => review(v.verse.id, "forgot")}>
            I forgot it
          </Button>
        </Card>
      ))}
    </>
  );
}
