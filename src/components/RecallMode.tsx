import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Eye,
  Grid2x2,
  Lightbulb,
  Pause,
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
import { isChineseChar, resolveDisplayMeanings, segmentAndAnnotate } from '../lib/segment';
import { isSpeechSupported } from '../lib/speech';
import { useSpeechPlayback } from '../lib/useSpeechPlayback';
import { getMnemonicsForText, loadDecomposition } from '../lib/mnemonics';
import { getRecallSpeed, recordRecallAttempt, setRecallSpeed } from '../lib/storage';
import { groupByDay } from '../lib/groupByDay';
import { pickSummarySoundFile, playSummarySound } from '../lib/summarySound';
import { FreehandCanvas, type FreehandCanvasHandle } from './FreehandCanvas';
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

  // "Split into words" vs "whole sentences" only produces a different result
  // once at least one selected item actually has more than one word — for a
  // single-word save either mode looks identical, so there's nothing to ask.
  // These must stay above the early returns below — hooks can't be called
  // conditionally, and session/savedPhrases.length change across renders.
  const hasSentenceSelected = useMemo(
    () =>
      savedPhrases.some(
        (p) => selectedIds.has(p.id) && segmentAndAnnotate(p.text, dict).filter((s) => s.isChinese).length > 1,
      ),
    [savedPhrases, selectedIds, dict],
  );

  useEffect(() => {
    if (!hasSentenceSelected) setSplitMode('words');
  }, [hasSentenceSelected]);

  const dayGroups = useMemo(() => groupByDay(savedPhrases), [savedPhrases]);

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

  function toggleDaySelected(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function startSession() {
    const selected = savedPhrases.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;
    // Shuffle which sentence comes first, not the words inside it — so in
    // "split into words" mode, random order still reads left-to-right
    // within each sentence, just in a random sentence-to-sentence order.
    const orderedPhrases = randomOrder ? shuffleArray(selected) : selected;
    const cards = buildCards(orderedPhrases, splitMode, dict);
    setSession((prev) => ({ key: (prev?.key ?? 0) + 1, cards }));
  }

  return (
    <div className={`test-picker recall-picker ${hasSentenceSelected ? 'test-picker-with-split' : ''}`}>

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
        <div className="day-groups">
          {dayGroups.map((group, i) => {
            const dayIds = group.items.map((p) => p.id);
            const allSelected = dayIds.every((id) => selectedIds.has(id));
            const someSelected = !allSelected && dayIds.some((id) => selectedIds.has(id));
            return (
              <details key={group.key} className="day-group" open={i === 0}>
                <summary className="day-group-summary">
                  <span className="day-group-summary-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleDaySelected(dayIds, e.target.checked)}
                      aria-label={`Select all phrases from ${group.label}`}
                    />
                    {group.label} <span className="day-group-count">({group.items.length})</span>
                  </span>
                  <ChevronDown size={18} className="day-group-chevron" aria-hidden="true" />
                </summary>
                <div className="day-group-body">
                  <ul className="saved-list">
                    {group.items.map((p) => (
                      <li key={p.id} className="saved-row">
                        <label className="recall-checkbox-row">
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                          <span className="saved-text">{p.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {hasSentenceSelected && (
        <div className="split-toggle split-toggle-pop" role="radiogroup" aria-label="How to split phrases">
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
      )}

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
  // One snapshot per attempt, oldest first, so a retried word's later
  // attempts sit after its earlier ones — captured just before moving on
  // (see handleMark), not persisted anywhere beyond this session.
  const [drawings, setDrawings] = useState<Record<string, string[]>>({});
  const canvasHandleRef = useRef<FreehandCanvasHandle>(null);
  const [decomp, setDecomp] = useState<DecompositionData | null>(null);
  const [speed, setSpeed] = useState(() => getRecallSpeed());
  const { isSpeaking, isPaused, play: playText, togglePause: togglePausePlayback } = useSpeechPlayback();

  const speechSupported = isSpeechSupported();
  const current = queue[index];
  const finished = index >= queue.length;
  // Stable across the whole session (initialCards never changes), reused by
  // both the perfect-score check below and the summary screen's list.
  const uniqueCards = useMemo(
    () => Array.from(new Map(initialCards.map((c) => [c.id, c])).values()),
    [initialCards],
  );
  const summarySoundPlayedRef = useRef(false);

  useEffect(() => {
    loadDecomposition()
      .then(setDecomp)
      .catch(() => setDecomp({}));
  }, []);

  // First-try score: a card only counts as correct here if it was known
  // with zero retries — one that needed a retry (even if eventually gotten
  // right) doesn't count, same as a mistake in Practise mode never counts.
  // 100% plays the celebratory sound, 50-99% a "good effort" sound, and
  // below 50% the gentler "keep trying" sound. Guarded by a ref (not just
  // `finished`) so it fires once per session rather than on every
  // re-render of the summary screen.
  useEffect(() => {
    if (!finished || summarySoundPlayedRef.current || uniqueCards.length === 0) return;
    summarySoundPlayedRef.current = true;
    const firstTryCorrect = uniqueCards.filter(
      (c) => finalResults[c.id] && (retryCounts[c.id] ?? 0) === 0,
    ).length;
    playSummarySound(pickSummarySoundFile(firstTryCorrect / uniqueCards.length));
  }, [finished, uniqueCards, finalResults, retryCounts]);

  function play(rate: number) {
    if (!current) return;
    playText(current.displayText, rate);
  }

  // useLayoutEffect (not useEffect) so `revealed` resets before the browser
  // paints the new card — otherwise the next word flashes onscreen for a
  // frame with the *previous* card's revealed=true state still applied.
  useLayoutEffect(() => {
    if (!finished && current) {
      setRevealed(false);
      play(speed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function handleSpeedChange(rate: number) {
    setSpeed(rate);
    setRecallSpeed(rate);
    if (current) play(rate);
  }

  function togglePause() {
    togglePausePlayback(speed);
  }

  function handleMark(know: boolean) {
    if (!current) return;
    recordRecallAttempt({ cardId: current.id, text: current.displayText, know, attemptedAt: Date.now() });
    setFinalResults((r) => ({ ...r, [current.id]: know }));

    // Word-mode cards only — sentence cards don't render a canvas at all.
    // Captured now (not on an interval) since this is the exact moment the
    // student is done with this attempt, whether they got it right or need
    // another try.
    const snapshot = canvasHandleRef.current?.getSnapshot();
    if (snapshot) {
      setDrawings((d) => ({ ...d, [current.id]: [...(d[current.id] ?? []), snapshot] }));
    }

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
            const attempts = drawings[c.id];
            const latest = attempts?.[attempts.length - 1];
            const earlier = attempts?.slice(0, -1) ?? [];
            return (
              <li key={c.id} className={neededRetry ? 'summary-orange' : 'summary-correct'}>
                <div className="summary-row">
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
                </div>
                {latest && (
                  <div className="summary-writing">
                    <img src={latest} alt={`Your latest writing of "${c.displayText}"`} className="writing-review-img" />
                    {earlier.length > 0 && (
                      <details className="writing-review-earlier">
                        <summary>
                          Show earlier tr{earlier.length === 1 ? 'y' : 'ies'} ({earlier.length})
                        </summary>
                        <div className="writing-review-earlier-grid">
                          {earlier.map((snapshot, i) => (
                            <img
                              key={i}
                              src={snapshot}
                              alt={`Attempt ${i + 1} of "${c.displayText}"`}
                              className="writing-review-img"
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
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
            <ArrowLeft size={18} aria-hidden="true" /> Back to Test setup
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
            onClick={() => (isSpeaking ? togglePause() : play(speed))}
            disabled={!speechSupported}
            aria-label={
              revealed
                ? `Play "${current.displayText}" again`
                : !isSpeaking
                  ? 'Play audio'
                  : isPaused
                    ? 'Continue reading'
                    : 'Pause reading'
            }
          >
            {revealed ? (
              <span className="recall-audio-circle-text">{current.displayText}</span>
            ) : !isSpeaking ? (
              <Volume2 size={40} aria-hidden="true" />
            ) : isPaused ? (
              <Play size={40} aria-hidden="true" />
            ) : (
              <Pause size={40} aria-hidden="true" />
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
          <div className="recall-pinyin-hint">
            {chineseSegments.map((s, i) => (
              <span key={i} className="recall-pinyin-hint-word">
                {s.pinyin}
              </span>
            ))}
          </div>
        )}

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
                  {resolveDisplayMeanings(chineseSegments[0].meanings, chineseSegments[0].pinyin).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="recall-gloss">
                  {chineseSegments.map((s) => resolveDisplayMeanings(s.meanings, s.pinyin)[0]).join(' · ')}
                </p>
              )}
            </div>
          </details>
        )}

        {!current.id.startsWith('phrase:') && (
          <FreehandCanvas key={`${current.id}-${index}`} ref={canvasHandleRef} readOnly={revealed} />
        )}

        {revealed && (
          <div className="recall-answer">
            {chineseSegments.map((s, i) => (
              <div key={i} className="recall-answer-word">
                <div className="detail-heading">
                  <span className="detail-hanzi">{s.text}</span>
                  <span className="detail-pinyin">{s.pinyin}</span>
                </div>
                <ul className="detail-meanings">
                  {resolveDisplayMeanings(s.meanings, s.pinyin).map((m, mi) => (
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
            <button type="button" className="btn btn-accent recall-know" onClick={() => handleMark(true)}>
              <CheckCircle2 size={18} aria-hidden="true" /> I know it
            </button>
            <button type="button" className="btn btn-ghost recall-dontknow" onClick={() => handleMark(false)}>
              <XCircle size={18} aria-hidden="true" /> I don't know it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
