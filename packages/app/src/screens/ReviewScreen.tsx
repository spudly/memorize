import { MemorizeReviewPage, type MemorizeReviewPageVerse } from "@spudly/ui/pages";
import { dueVerses, type MemorizeStore } from "@memorize/core";

interface Props {
  store: MemorizeStore;
}

/**
 * Review tab host (#49): the app keeps the spaced-repetition
 * business logic — computing which verses are due from the store
 * and recording the review outcomes — and hands the finished due
 * list to the DS MemorizeReviewPage as view-models. The page
 * composes the "Review (N due)" heading from the list's length
 * and renders the app's nothing-due empty state itself; store
 * readiness is gated in App, above this screen, so there is no
 * loading state here.
 */
export default function ReviewScreen({ store }: Props) {
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
        store.actions.recordReview(verseId, "remembered");
      }}
      onForgotPress={(verseId) => {
        store.actions.recordReview(verseId, "forgot");
      }}
    />
  );
}
