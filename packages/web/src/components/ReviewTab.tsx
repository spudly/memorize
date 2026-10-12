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
      <section>
        <h2>Review</h2>
        <p className="hint">Nothing due. Nice work.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Review ({due.length} due)</h2>
      <ul className="verse-list">
        {due.map((v) => (
          <li key={v.verse.id}>
            <strong>{v.verse.reference}</strong>
            <p>{v.verse.text}</p>
            <div className="row">
              <button onClick={() => review(v.verse.id, "remembered")}>I remembered it</button>
              <button onClick={() => review(v.verse.id, "forgot")}>I forgot it</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
