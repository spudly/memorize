import { MemorizeReviewPage, type MemorizeReviewPageVerse } from "@spudly/ui";
import { dueVerses, type MemorizeStore } from "@memorize/core";

type Props = {
  store: MemorizeStore;
};

/**
 * Review tab host (#96): the spaced-repetition logic — computing
 * due verses and recording outcomes — stays app-side and the DS
 * MemorizeReviewPage renders the heading, rows, and nothing-due
 * empty state from the view-models.
 */
export default function ReviewTab({ store }: Props) {
  const verses: MemorizeReviewPageVerse[] = dueVerses(store.getState().data.verses, new Date()).map(
    (item) => ({
      id: item.verse.id,
      reference: item.verse.reference,
      text: item.verse.text,
    }),
  );

  return (
    <MemorizeReviewPage
      verses={verses}
      onRememberedPress={(verseId) => {
        void store.actions.recordReview(verseId, "remembered");
      }}
      onForgotPress={(verseId) => {
        void store.actions.recordReview(verseId, "forgot");
      }}
    />
  );
}
