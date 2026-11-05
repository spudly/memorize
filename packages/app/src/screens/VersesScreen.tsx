import { MyVersesPage } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";
import { toMyVersesPageItems } from "./versesPageModel";

type Props = {
  store: MemorizeStore;
};

/**
 * "My verses" tab — a thin host over the DS MyVersesPage (#49).
 * All state and business logic stay app-side: the memorize store
 * and the remove mutation. Drill navigation is NOT a callback:
 * each row carries its canonical `memorize://drill/<id>` href
 * (see versesPageModel) and App handles that deep link. There is
 * no loading state here — App gates on store readiness before
 * any tab renders.
 */
export default function VersesScreen({ store }: Props) {
  const { verses } = store.getState().data;

  return (
    <MyVersesPage
      verses={toMyVersesPageItems(verses)}
      onRemoveVerse={(id) => void store.actions.removeVerse(id)}
    />
  );
}
