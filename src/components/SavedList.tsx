import { useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { segmentAndAnnotate } from '../lib/segment';
import { WordDetailPanel } from './WordDetailPanel';
import type { Dictionary, SavedPhrase } from '../types';

interface SavedListProps {
  phrases: SavedPhrase[];
  dict: Dictionary;
  onOpen: (text: string) => void;
  onDelete: (id: string) => void;
}

interface InlineDetail {
  text: string;
  pinyin: string | null;
  meanings: string[] | null;
}

export function SavedList({ phrases, dict, onOpen, onDelete }: SavedListProps) {
  const [inlineDetail, setInlineDetail] = useState<InlineDetail | null>(null);

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

  function handleTap(text: string) {
    // A single word/phrase has exactly one meaning to show, so it's shown
    // right here without leaving the list; a multi-word sentence has no one
    // obvious meaning, so that still opens the full breakdown in Reader.
    const chineseSegments = segmentAndAnnotate(text, dict).filter((s) => s.isChinese);
    if (chineseSegments.length === 1) {
      const seg = chineseSegments[0];
      setInlineDetail({ text: seg.text, pinyin: seg.pinyin, meanings: seg.meanings });
    } else {
      onOpen(text);
    }
  }

  return (
    <>
      <ul className="saved-list">
        {phrases.map((p) => (
          <li key={p.id} className="saved-row">
            <button type="button" className="saved-text saved-text-btn" onClick={() => handleTap(p.text)}>
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

      {inlineDetail && (
        <WordDetailPanel
          text={inlineDetail.text}
          pinyin={inlineDetail.pinyin}
          meanings={inlineDetail.meanings}
          onClose={() => setInlineDetail(null)}
        />
      )}
    </>
  );
}
