import { Bookmark, Trash2 } from 'lucide-react';
import type { SavedPhrase } from '../types';

interface SavedListProps {
  phrases: SavedPhrase[];
  onOpen: (text: string) => void;
  onDelete: (id: string) => void;
}

export function SavedList({ phrases, onOpen, onDelete }: SavedListProps) {
  if (phrases.length === 0) {
    return (
      <p className="empty-state">
        No saved phrases yet. Go to <strong>Reader</strong>, paste a phrase, and tap{' '}
        <span className="icon-inline">
          <Bookmark size={14} aria-hidden="true" /> Save to my list
        </span>
        .
      </p>
    );
  }

  return (
    <ul className="saved-list">
      {phrases.map((p) => (
        <li key={p.id} className="saved-row">
          <button type="button" className="saved-text saved-text-btn" onClick={() => onOpen(p.text)}>
            {p.text}
          </button>
          <div className="saved-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => onDelete(p.id)}
              aria-label={`Delete "${p.text}"`}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
