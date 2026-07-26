import { useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Eye,
  Grid2x2,
  Lightbulb,
  PartyPopper,
  Play,
  Rabbit,
  RotateCcw,
  ScrollText,
  Shuffle,
  Turtle,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { isChineseChar, segmentAndAnnotate } from '../lib/segment';
import { speak, isSpeechSupported } from '../lib/speech';
import { getMnemonicsForText, loadDecomposition } from '../lib/mnemonics';
import { getRecallSpeed, recordRecallAttempt, setRecallSpeed } from '../lib/storage';
import { FreehandCanvas } from './FreehandCanvas';
import type { AnnotatedSegment, DecompositionData, Dictionary, SavedPhrase } from '../types';

interface RecallModeProps {
  savedPhrases: SavedPhrase[];
  dict: Dictionary;
  onGoToReader: () => void;
}

type SplitMode = 'words' | 'sentences';

interface RecallCard {
  id: string;
  displayText: string;
  segments: AnnotatedSegment[];
}

function buildCards(selected: SavedPhrase[], mode: SplitMode, dict: Dictionary): RecallCard[] {
  if (mode === 'sentences') {
    return selected.map((p) => ({
      id: `phrase:${p.id}`,
      displayText: p.text,
      segments: segmentAndAnnotate(p.text, dict),
    }));
  }

  const seen = new Map<string, RecallCard>();
  for (const p of selected) {
    for (const seg of segmentAndAnnotate(p.text, dict)) {
      if (!seg.isChinese || seen.has(seg.text)) continue;
      seen.set(seg.text, { id: `word:${seg.text}`, displayText: seg.text, segments: [seg] });
    }
  }
  return Array.from(seen.values());
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function RecallMode({ savedPhrases, dict, onGoToReader }: RecallModeProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>('words');
  const [randomOrder, setRandomOrder] = useState(false);
  const [session, setSession] = useState<{ key: number; cards: RecallCard[] } | null>(null);

  if (session) {
    return (
      <RecallSession
        key={session.key}
        initialCards={session.cards}
        dict={dict}
        randomOrder={randomOrder}
        onRetestCards={(cards) => setSession((prev) => ({ key: (prev?.key ?? 0) + 1, cards }))}
        onExit={() => setSession(null)}
      />
    );
  }

  if (savedPhrases.length === 0) {
    return (
      <div className="test-picker">
        <p className="empty-state">
          No saved phrases yet. Go to <strong>Reader</strong>, paste a phrase, and tap{' '}
          <span className="icon-inline">
            <Bookmark size={14} aria-hidden="true" /> Save to my list
          </span>{' '}
          first.
        </p>
        <button type="button" className="btn btn-primary" onClick={onGoToReader}>
          Go to Reader
        </button>
      </div>
    );
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startSession() {
    const selected = savedPhrases.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    let cards = buildCards(selected, splitMode, dict);
    if (randomOrder) cards = shuffleArray(cards);
    setSession((prev) => ({ key: (prev?.key ?? 0) + 1, cards }));
  }

  return (
    <div className="test-picker">
      <h2>Listen &amp; Recall</h2>
      <p className="hint-text">Choose which saved phrases to review, and how to split them into cards.</p>

      <div className="split-toggle" role="radiogroup" aria-label="How to split phrases">
        <button
          type="button"
          className={`toggle-btn ${splitMode === 'words' ? 'toggle-btn-active' : ''}`}
          onClick={() => setSplitMode('words')}
        >
          <Grid2x2 size={16} aria-hidden="true" /> Split into words
        </button>
        <button
          type="button"
          className={`toggle-btn ${splitMode === 'sentences' ? 'toggle-btn-active' : ''}`}
          onClick={() => setSplitMode('sentences')}
        >
          <ScrollText size={16} aria-hidden="true" /> Whole sentences
        </button>
      </div>

      <div className="picker-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds(new Set(savedPhrases.map((p) => p.id)))}>
          Select all
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>
          Clear
        </button>
        <label className="recall-random-toggle">
          <input type="checkbox" checked={randomOrder} onChange={(e) => setRandomOrder(e.target.checked)} />
          <span className="icon-inline">
            <Shuffle size={16} aria-hidden="true" /> Random order
          </span>
        </label>
      </div>

      <div className="recall-phrase-scroll">
        <ul className="saved-list">
          {savedPhrases.map((p) => (
            <li key={p.id} className="saved-row">
              <label className="recall-checkbox-row">
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                <span className="saved-text">{p.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="recall-start-bar">
        <button type="button" className="btn btn-primary" onClick={startSession} disabled={selectedIds.size === 0}>
          <Play size={18} aria-hidden="true" /> Start test ({selectedIds.size} selected)
        </button>
      </div>
    </div>
  );
}

function RecallSession({
  initialCards,
  dict,
  randomOrder,
  onRetestCards,
  onExit,
}: {
  initialCards: RecallCard[];
  dict: Dictionary;
  randomOrder: boolean;
  onRetestCards: (cards: RecallCard[]) => void;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<RecallCard[]>(initialCards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finalResults, setFinalResults] = useState<Record<string, boolean>>({});
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [decomp, setDecomp] = useState<DecompositionData | null>(null);
  const [speed, setSpeed] = useState(() => getRecallSpeed());

  const speechSupported = isSpeechSupported();
  const current = queue[index];
  const finished = index >= queue.length;

  useEffect(() => {
    loadDecomposition()
      .then(setDecomp)
      .catch(() => setDecomp({}));
  }, []);

  useEffect(() => {
    if (!finished && current) {
      setRevealed(false);
      speak(current.displayText, speed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function handleSpeedChange(rate: number) {
    setSpeed(rate);
    setRecallSpeed(rate);
    if (current) speak(current.displayText, rate);
  }

  function handleMark(know: boolean) {
    if (!current) return;
    recordRecallAttempt({ cardId: current.id, text: current.displayText, know, attemptedAt: Date.now() });
    setFinalResults((r) => ({ ...r, [current.id]: know }));

    if (!know) {
      const retries = retryCounts[current.id] ?? 0;
      if (retries < 2) {
        setRetryCounts((r) => ({ ...r, [current.id]: retries + 1 }));
        setQueue((q) => {
          const copy = [...q];
          // Give a missed word real distance before it resurfaces — at
          // least 5 cards, or halfway through whatever's left, whichever
          // is bigger — rather than popping back up almost immediately.
          const remaining = copy.length - index;
          const gap = Math.max(5, Math.floor(remaining / 2));
          const insertAt = Math.min(copy.length, index + gap);
          copy.splice(insertAt, 0, current);
          return copy;
        });
      }
    }
    setIndex((i) => i + 1);
  }

  if (finished) {
    const uniqueCards = Array.from(new Map(initialCards.map((c) => [c.id, c])).values());
    const knownCount = uniqueCards.filter((c) => finalResults[c.id]).length;
    // A card only ever gets requeued after a wrong mark, so "was retried at
    // least once" is exactly "was wrong on the first attempt" — regardless
    // of whether it was eventually gotten right.
    const orangeCards = uniqueCards.filter((c) => (retryCounts[c.id] ?? 0) > 0);

    function handleRetestOrange() {
      if (orangeCards.length === 0) return;
      onRetestCards(randomOrder ? shuffleArray(orangeCards) : orangeCards);
    }

    return (
      <div className="test-session test-summary">
        <h2 className="icon-inline">
          <PartyPopper size={22} aria-hidden="true" /> Nice work!
        </h2>
        <p className="score-line">
          {knownCount} / {uniqueCards.length} marked "I know it"
        </p>
        <ul className="summary-list">
          {uniqueCards.map((c) => {
            const neededRetry = (retryCounts[c.id] ?? 0) > 0;
            return (
              <li key={c.id} className={neededRetry ? 'summary-orange' : 'summary-correct'}>
                <span className="summary-char">{c.displayText}</span>
                <span className="icon-inline">
                  {neededRetry ? (
                    finalResults[c.id] ? (
                      'Got it after a retry'
                    ) : (
                      'Still tricky'
                    )
                  ) : (
                    <>
                      <CheckCircle2 size={16} aria-hidden="true" /> Know it
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="test-summary-actions">
          {orangeCards.length > 0 && (
            <button type="button" className="btn btn-accent" onClick={handleRetestOrange}>
              <RotateCcw size={18} aria-hidden="true" /> Retest {orangeCards.length} tricky word
              {orangeCards.length === 1 ? '' : 's'}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Back to Recall setup
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const mnemonics = decomp ? getMnemonicsForText(current.displayText, decomp, dict, isChineseChar) : [];
  const chineseSegments = current.segments.filter((s) => s.isChinese);

  return (
    <div className="test-session recall-session">
      <div className="recall-session-header">
        <div className="test-progress">
          Card {index + 1} of {queue.length}
        </div>
        <button type="button" className="icon-btn recall-stop-btn" onClick={onExit} aria-label="Stop test">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="recall-card">
        <div className="recall-top-row">
          <button
            type="button"
            className="recall-audio-circle"
            onClick={() => speak(current.displayText, speed)}
            disabled={!speechSupported}
            aria-label={revealed ? `Play "${current.displayText}" again` : 'Play audio'}
          >
            {revealed ? (
              <span className="recall-audio-circle-text">{current.displayText}</span>
            ) : (
              <Volume2 size={40} aria-hidden="true" />
            )}
          </button>

          <div className="recall-speed-vertical-wrap">
            <Rabbit size={16} aria-hidden="true" />
            <input
              id="recall-speed"
              type="range"
              className="recall-speed-vertical"
              min={0.5}
              max={1.5}
              step={0.1}
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              disabled={!speechSupported}
              aria-label="Playback speed"
            />
            <Turtle size={16} aria-hidden="true" />
            <span className="recall-speed-value">{speed.toFixed(1)}x</span>
          </div>
        </div>

        {!revealed && (
          <details className="recall-meaning-accordion">
            <summary className="recall-meaning-summary">
              <span className="icon-inline">
                <ChevronDown size={16} className="recall-accordion-chevron" aria-hidden="true" /> Meaning
              </span>
            </summary>
            <div className="recall-meaning-content">
              {chineseSegments.length === 1 ? (
                <ul className="detail-meanings">
                  {(chineseSegments[0].meanings ?? ['No dictionary entry found.']).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="recall-gloss">
                  {chineseSegments.map((s) => s.meanings?.[0] ?? '?').join(' · ')}
                </p>
              )}
            </div>
          </details>
        )}

        <FreehandCanvas key={`${current.id}-${index}`} char={current.displayText} />

        {revealed && (
          <div className="recall-answer">
            {chineseSegments.map((s, i) => (
              <div key={i} className="recall-answer-word">
                <div className="detail-heading">
                  <span className="detail-hanzi">{s.text}</span>
                  <span className="detail-pinyin">{s.pinyin}</span>
                </div>
                <ul className="detail-meanings">
                  {(s.meanings ?? ['No dictionary entry found.']).map((m, mi) => (
                    <li key={mi}>{m}</li>
                  ))}
                </ul>
              </div>
            ))}

            {mnemonics.length > 0 && (
              <div className="mnemonic-box">
                <h3 className="icon-inline">
                  <Lightbulb size={16} aria-hidden="true" /> Creative ways to remember
                </h3>
                <ul>
                  {mnemonics.map((m) => (
                    <li key={m.char}>
                      <strong>{m.char}</strong>: {m.hint ?? 'No breakdown available — make up your own story for this one!'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="recall-action-bar">
        {!revealed ? (
          <button type="button" className="btn btn-accent recall-reveal-btn" onClick={() => setRevealed(true)}>
            <Eye size={18} aria-hidden="true" /> Show answer
          </button>
        ) : (
          <div className="recall-mark-buttons">
            <button type="button" className="btn btn-ghost recall-dontknow" onClick={() => handleMark(false)}>
              <XCircle size={18} aria-hidden="true" /> I don't know it
            </button>
            <button type="button" className="btn btn-accent recall-know" onClick={() => handleMark(true)}>
              <CheckCircle2 size={18} aria-hidden="true" /> I know it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
