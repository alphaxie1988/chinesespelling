import { Bookmark, PenLine, Trash2 } from 'lucide-react';
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
          <span className="saved-text">{p.text}</span>
          <div className="saved-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onOpen(p.text)}>
              Open
            </button>
            <button type="button" className="btn btn-accent" onClick={() => onTest(p)}>
              <PenLine size={16} aria-hidden="true" /> Test
            </button>
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
