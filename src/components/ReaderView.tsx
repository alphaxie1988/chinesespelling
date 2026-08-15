import { useMemo, useState } from 'react';
import { Bookmark, CheckCircle2, Grid2x2, Pause, Play, Volume2, X } from 'lucide-react';
import { segmentAndAnnotate } from '../lib/segment';
import { isSpeechSupported } from '../lib/speech';
import { useSpeechPlayback } from '../lib/useSpeechPlayback';
import { CameraScan } from './CameraScan';
import { WordDetailPanel } from './WordDetailPanel';
import type { AnnotatedSegment, Dictionary } from '../types';

const READ_ALOUD_RATE = 0.85;

interface ReaderViewProps {
  dict: Dictionary;
  text: string;
  onTextChange: (text: string) => void;
  onSave: (text: string) => void;
}

export function ReaderView({ dict, text, onTextChange, onSave }: ReaderViewProps) {
  const segments = useMemo(() => segmentAndAnnotate(text, dict), [text, dict]);
  const { isSpeaking, isPaused, highlightIndex, play, togglePause } = useSpeechPlayback();

  // Running start-offset (character index into `text`) of each segment, so
  // whichever word is currently being read aloud can be highlighted.
  const segmentOffsets = useMemo(() => {
    let offset = 0;
    return segments.map((seg) => {
      const start = offset;
      offset += seg.text.length;
      return start;
    });
  }, [segments]);

  const readingIndex = useMemo(() => {
    if (!isSpeaking || highlightIndex < 0) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segmentOffsets[i] <= highlightIndex) return i;
    }
    return -1;
  }, [isSpeaking, highlightIndex, segments, segmentOffsets]);

  // Regroups the flat segment list into rows that mirror the line breaks in
  // the pasted text, so e.g. two separate pasted lines still read as two
  // separate lines of chips below instead of one long wrapped run. A
  // non-Chinese segment can itself contain a line break (it's a run of
  // whitespace/punctuation), so it's what gets split to start a new row —
  // `idx` stays the original segments index throughout, since that's what
  // selection/read-aloud highlighting key off of.
  const displayLines = useMemo(() => {
    const lines: { key: string; idx: number; seg: AnnotatedSegment }[][] = [[]];
    segments.forEach((seg, idx) => {
      if (seg.isChinese) {
        lines[lines.length - 1].push({ key: `${idx}`, idx, seg });
        return;
      }
      const parts = seg.text.split('\n');
      parts.forEach((part, partIdx) => {
        if (part) lines[lines.length - 1].push({ key: `${idx}-${partIdx}`, idx, seg: { ...seg, text: part } });
        if (partIdx < parts.length - 1) lines.push([]);
      });
    });
    return lines.filter((line) => line.length > 0);
  }, [segments]);

  // "Split into words" only makes sense for a line long enough to actually
  // contain more than one word — a line of 5 Chinese characters or fewer
  // reads as a single short phrase, so the button is hidden unless at least
  // one pasted line is longer than that.
  const hasLongLine = useMemo(
    () =>
      displayLines.some((line) =>
        line.reduce((sum, item) => sum + (item.seg.isChinese ? item.seg.text.length : 0), 0) > 5,
      ),
    [displayLines],
  );

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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (isSpeaking ? togglePause(READ_ALOUD_RATE) : play(text, READ_ALOUD_RATE))}
          disabled={!hasText || !speechSupported}
        >
          {!isSpeaking ? (
            <Volume2 size={18} aria-hidden="true" />
          ) : isPaused ? (
            <Play size={18} aria-hidden="true" />
          ) : (
            <Pause size={18} aria-hidden="true" />
          )}
          Read aloud
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
        {hasLongLine && (
          <button type="button" className="btn btn-accent" onClick={handleSplitSave} disabled={!hasText}>
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
        )}
      </div>

      {!speechSupported && (
        <p className="hint-text">Your browser doesn't support reading text aloud — try Chrome or Safari.</p>
      )}

      {hasText && (
        <div className="segments" role="list">
          {displayLines.map((line, li) => (
            <div key={li} className="segments-line">
              <span className="segments-line-number">{li + 1}.</span>
              <div className="segments-row">
                {line.map(({ key, idx, seg }) =>
                  seg.isChinese ? (
                    <button
                      type="button"
                      key={key}
                      role="listitem"
                      className={`chip ${selected === idx ? 'chip-selected' : ''} ${idx === readingIndex ? 'chip-reading' : ''}`}
                      onClick={() => setSelected(selected === idx ? null : idx)}
                    >
                      <span className="chip-pinyin">{seg.pinyin}</span>
                      <span className="chip-hanzi">{seg.text}</span>
                    </button>
                  ) : (
                    <span key={key} className="plain-text">
                      {seg.text}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
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
          dict={dict}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
