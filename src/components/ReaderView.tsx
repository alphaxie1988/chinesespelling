import { useMemo, useState } from 'react';
import { Bookmark, CheckCircle2, Volume2, X } from 'lucide-react';
import { segmentAndAnnotate } from '../lib/segment';
import { speak, isSpeechSupported } from '../lib/speech';
import type { Dictionary } from '../types';

interface ReaderViewProps {
  dict: Dictionary;
  text: string;
  onTextChange: (text: string) => void;
  onSave: (text: string) => void;
}

export function ReaderView({ dict, text, onTextChange, onSave }: ReaderViewProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState<{ count: number } | null>(null);

  const segments = useMemo(() => segmentAndAnnotate(text, dict), [text, dict]);
  const hasText = text.trim().length > 0;
  const speechSupported = isSpeechSupported();

  function handleSave() {
    if (!hasText) return;
    // Each line break is treated as a separate sentence/phrase, so pasting a
    // list of words/sentences saves them individually instead of as one blob.
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    lines.forEach((line) => onSave(line));
    setSavedFlash({ count: lines.length });
    setTimeout(() => setSavedFlash(null), 1600);
  }

  return (
    <div className="reader">
      <textarea
        className="reader-input"
        placeholder="粘贴中文短语或句子… (Paste a Chinese phrase or sentence here)"
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value);
          setSelected(null);
        }}
        rows={4}
      />

      <div className="reader-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => speak(text)} disabled={!hasText || !speechSupported}>
          <Volume2 size={18} aria-hidden="true" /> Read aloud
        </button>
        <button type="button" className="btn btn-accent" onClick={handleSave} disabled={!hasText}>
          {savedFlash ? (
            <>
              <CheckCircle2 size={18} aria-hidden="true" />
              {savedFlash.count > 1 ? `Saved ${savedFlash.count} phrases!` : 'Saved!'}
            </>
          ) : (
            <>
              <Bookmark size={18} aria-hidden="true" />
              Save to my list
            </>
          )}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { onTextChange(''); setSelected(null); }} disabled={!hasText}>
          Clear
        </button>
      </div>

      {!speechSupported && (
        <p className="hint-text">Your browser doesn't support reading text aloud — try Chrome or Safari.</p>
      )}

      {hasText && (
        <div className="segments" role="list">
          {segments.map((seg, idx) =>
            seg.isChinese ? (
              <button
                type="button"
                key={idx}
                role="listitem"
                className={`chip ${selected === idx ? 'chip-selected' : ''}`}
                onClick={() => setSelected(selected === idx ? null : idx)}
              >
                <span className="chip-pinyin">{seg.pinyin}</span>
                <span className="chip-hanzi">{seg.text}</span>
              </button>
            ) : (
              <span key={idx} className="plain-text">
                {seg.text}
              </span>
            ),
          )}
        </div>
      )}

      {!hasText && (
        <p className="empty-state">
          Paste a Chinese word, phrase, or sentence above to see pinyin, tap for meanings, and hear it read aloud.
        </p>
      )}

      {selected !== null && segments[selected] && (
        <>
          <div className="detail-backdrop" onClick={() => setSelected(null)} />
          <div className="detail-panel">
            <div className="detail-header">
              <div className="detail-heading">
                <span className="detail-hanzi">{segments[selected].text}</span>
                <span className="detail-pinyin">{segments[selected].pinyin}</span>
              </div>
              <div className="detail-header-actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => speak(segments[selected]!.text)}
                  disabled={!speechSupported}
                  aria-label="Read this word aloud"
                >
                  <Volume2 size={20} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            <ul className="detail-meanings">
              {(segments[selected].meanings ?? ['No dictionary entry found for this word.']).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
