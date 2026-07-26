import { useMemo, useState } from 'react';
import { Bookmark, CheckCircle2, Grid2x2, Volume2, X } from 'lucide-react';
import { segmentAndAnnotate } from '../lib/segment';
import { speak, isSpeechSupported } from '../lib/speech';
import { CameraScan } from './CameraScan';
import { WordDetailPanel } from './WordDetailPanel';
import type { Dictionary } from '../types';

interface ReaderViewProps {
  dict: Dictionary;
  text: string;
  onTextChange: (text: string) => void;
  onSave: (text: string) => void;
}

export function ReaderView({ dict, text, onTextChange, onSave }: ReaderViewProps) {
  const segments = useMemo(() => segmentAndAnnotate(text, dict), [text, dict]);

  // If this phrase is a single Chinese word (e.g. opened from "My List"),
  // its meaning is shown right away instead of requiring an extra tap —
  // with more than one word there's no single obvious one to reveal.
  const [selected, setSelected] = useState<number | null>(() => {
    const chineseIndices = segments.reduce<number[]>((acc, seg, idx) => (seg.isChinese ? [...acc, idx] : acc), []);
    return chineseIndices.length === 1 ? chineseIndices[0] : null;
  });
  const [savedFlash, setSavedFlash] = useState<{ count: number } | null>(null);
  const [splitFlash, setSplitFlash] = useState<{ count: number } | null>(null);

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

  function handleSplitSave() {
    if (!hasText) return;
    // Reuses the same segmentation shown as chips below, so "each word" here
    // always matches exactly what's tappable on screen.
    const uniqueWords: string[] = [];
    const seen = new Set<string>();
    for (const seg of segments) {
      if (seg.isChinese && !seen.has(seg.text)) {
        seen.add(seg.text);
        uniqueWords.push(seg.text);
      }
    }
    if (uniqueWords.length === 0) return;

    // Each save prepends to the top of My List, so saving in reverse order
    // means the first word ends up on top — matching reading order.
    [...uniqueWords].reverse().forEach((word) => onSave(word));
    setSplitFlash({ count: uniqueWords.length });
    setTimeout(() => setSplitFlash(null), 1600);
  }

  return (
    <div className="reader">
      <div className="reader-input-wrap">
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
        {hasText && (
          <button
            type="button"
            className="reader-clear-btn"
            onClick={() => {
              onTextChange('');
              setSelected(null);
            }}
            aria-label="Clear text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="reader-toolbar">
        <CameraScan
          onConfirm={(lines) => {
            onTextChange(lines.join('\n'));
            setSelected(null);
          }}
        />
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
        <button type="button" className="btn btn-ghost" onClick={handleSplitSave} disabled={!hasText}>
          {splitFlash ? (
            <>
              <CheckCircle2 size={18} aria-hidden="true" />
              {splitFlash.count > 1 ? `Saved ${splitFlash.count} words!` : 'Saved!'}
            </>
          ) : (
            <>
              <Grid2x2 size={18} aria-hidden="true" />
              Split into words
            </>
          )}
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
        <WordDetailPanel
          text={segments[selected].text}
          pinyin={segments[selected].pinyin}
          meanings={segments[selected].meanings}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
