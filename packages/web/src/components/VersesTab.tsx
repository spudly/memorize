import type { MemorizeStore } from "@memorize/core";

interface Props {
  store: MemorizeStore;
  onDrill(id: string): void;
}

export default function VersesTab({ store, onDrill }: Props) {
  const { verses } = store.getState().data;

  if (verses.length === 0) {
    return (
      <section>
        <h2>My verses</h2>
        <p className="hint">No verses yet — find one in the Search tab to get started.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>My verses</h2>
      <ul className="verse-list">
        {verses.map((v) => (
          <li key={v.verse.id}>
            <strong>{v.verse.reference}</strong>{" "}
            <span className={`badge ${v.status}`}>{v.status}</span>
            <p>{v.verse.text}</p>
            <p className="hint">
              {v.nextReviewAt
                ? `Next review: ${new Date(v.nextReviewAt).toLocaleDateString()}`
                : "Not scheduled"}
            </p>
            <div className="row">
              <button onClick={() => onDrill(v.verse.id)}>Drill</button>
              <button onClick={() => store.actions.removeVerse(v.verse.id)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
