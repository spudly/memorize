import { MyVersesPage } from "@spudly/ui/pages";
import type { MemorizeStore } from "@memorize/core";
import { toMyVersesPageItems } from "./versesPageModel";

interface Props {
  store: MemorizeStore;
  onDrill(id: string): void;
}

/**
 * "My verses" tab — a thin host over the DS MyVersesPage (#49).
 * All state and business logic stay app-side: the memorize store,
 * the remove mutation, and drill navigation. The page renders the
 * heading, the empty state, and the rows from the composed
 * view-models (see versesPageModel); its row actions come back as
 * bare intents by verse id. There is no loading state here — App
 * gates on store readiness before any tab renders.
 */
export default function VersesScreen({ store, onDrill }: Props) {
  const { verses } = store.getState().data;

  return (
    <MyVersesPage
      verses={toMyVersesPageItems(verses)}
      onDrillVerse={onDrill}
      onRemoveVerse={(id) => store.actions.removeVerse(id)}
    />
  );
}
