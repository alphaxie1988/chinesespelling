import type { SavedPhrase } from '../types';

interface SavedListProps {
  phrases: SavedPhrase[];
  onOpen: (text: string) => void;
  onTest: (phrase: SavedPhrase) => void;
  onDelete: (id: string) => void;
}

export function SavedList({ phrases, onOpen, onTest, onDelete }: SavedListProps) {
  if (phrases.length === 0) {
    return (
      <p className="empty-state">
        No saved phrases yet. Go to <strong>Reader</strong>, paste a phrase, and tap "⭐ Save to my list".
      </p>
    );
  }

  return (
    <ul className="saved-list">
      {phrases.map((p) => (
        <li key={p.id} className="saved-row">
          <span className="saved-text">{p.text}</span>
          <div className="saved-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onOpen(p.text)}>
              Open
            </button>
            <button type="button" className="btn btn-accent" onClick={() => onTest(p)}>
              ✍️ Test
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => onDelete(p.id)}
              aria-label={`Delete "${p.text}"`}
            >
              🗑️
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
