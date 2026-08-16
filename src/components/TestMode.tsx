import { useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  PartyPopper,
  PenLine,
  Shapes,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { isChineseChar, segmentAndAnnotate } from '../lib/segment';
import { hanziCharDataLoader } from '../lib/hanziData';
import { speak, isSpeechSupported } from '../lib/speech';
import { recordTestAttempt } from '../lib/storage';
import { groupByDay } from '../lib/groupByDay';
import { pickSummarySoundFile, playSummarySound } from '../lib/summarySound';
import { groupCharsByComponent, loadDecomposition } from '../lib/mnemonics';
import { WordDetailPanel } from './WordDetailPanel';
import type { DecompositionData, Dictionary, SavedPhrase } from '../types';

interface TestModeProps {
  savedPhrases: SavedPhrase[];
  phrase: SavedPhrase | null;
  dict: Dictionary | null;
  onPickPhrase: (phrase: SavedPhrase | null) => void;
  onOpenInReader: (text: string) => void;
  onGoToReader: () => void;
}

interface InlineDetail {
  text: string;
  pinyin: string | null;
  meanings: string[] | null;
}

/** One character to write, optionally labeled with the shared radical group
 * it's being practised as part of (radical-grouped sessions only). */
interface PracticeChar {
  char: string;
  groupLabel?: string;
}

function uniqueChineseChars(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const char of Array.from(text)) {
    if (isChineseChar(char) && !seen.has(char)) {
      seen.add(char);
      result.push(char);
    }
  }
  return result;
}

export function TestMode({ savedPhrases, phrase, dict, onPickPhrase, onOpenInReader, onGoToReader }: TestModeProps) {
  const dayGroups = useMemo(() => groupByDay(savedPhrases), [savedPhrases]);
  const [inlineDetail, setInlineDetail] = useState<InlineDetail | null>(null);
  const [decomp, setDecomp] = useState<DecompositionData | null>(null);
  const [radicalSession, setRadicalSession] = useState<PracticeChar[] | null>(null);
  // Which saved phrases feed the radical-grouping pool below — independent
  // of each row's own "Practise" button, which always practises just that
  // one phrase regardless of this selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDecomposition()
      .then(setDecomp)
      .catch(() => setDecomp({}));
  }, []);

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

  // Only characters that actually share a component with another selected
  // character are included — a lone character has nothing to compare
  // against, so grouping it wouldn't teach anything.
  const radicalGroups = useMemo(() => {
    if (!decomp || !dict) return [];
    const selectedText = savedPhrases
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.text)
      .join('');
    return groupCharsByComponent(uniqueChineseChars(selectedText), decomp, dict);
  }, [decomp, dict, savedPhrases, selectedIds]);
  const radicalCharCount = radicalGroups.reduce((sum, g) => sum + g.chars.length, 0);

  function startRadicalPractice() {
    setRadicalSession(radicalGroups.flatMap((g) => g.chars.map((char) => ({ char, groupLabel: g.label }))));
  }

  // Same behavior as tapping a phrase in My List: a single word shows its
  // meaning right here, a multi-word sentence opens in Reader instead.
  function handleTap(text: string) {
    if (!dict) {
      onOpenInReader(text);
      return;
    }
    const chineseSegments = segmentAndAnnotate(text, dict).filter((s) => s.isChinese);
    if (chineseSegments.length === 1) {
      const seg = chineseSegments[0];
      setInlineDetail({ text: seg.text, pinyin: seg.pinyin, meanings: seg.meanings });
    } else {
      onOpenInReader(text);
    }
  }

  if (radicalSession) {
    return (
      <QuizSession
        key="radical-practice"
        chars={radicalSession}
        phraseId="radical-practice"
        fallbackSubtitle="characters that share a radical"
        emptyMessage="No characters to practise."
        onExit={() => setRadicalSession(null)}
      />
    );
  }

  if (!phrase) {
    return (
      <div className="test-picker">
        {savedPhrases.length === 0 ? (
          <p className="empty-state">
            No saved phrases yet. Go to <strong>Reader</strong>, paste a phrase, and tap{' '}
            <span className="icon-inline">
              <Bookmark size={14} aria-hidden="true" /> Save to my list
            </span>{' '}
            first.
          </p>
        ) : (
          <>
            <div className="picker-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedIds(new Set(savedPhrases.map((p) => p.id)))}
              >
                Select all
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
            </div>

            <div className="radical-practice-cta">
              <button
                type="button"
                className="btn btn-accent radical-practice-btn"
                onClick={startRadicalPractice}
                disabled={radicalCharCount === 0}
              >
                <Shapes size={18} aria-hidden="true" /> Practise by shared radical ({radicalCharCount})
              </button>
              {radicalCharCount === 0 && (
                <p className="hint-text">
                  {selectedIds.size === 0
                    ? 'Check the words below whose characters you want to practise, then come back here.'
                    : "None of the selected words' characters share a radical with each other."}
                </p>
              )}
            </div>

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
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelected(p.id)}
                            />
                            <button
                              type="button"
                              className="saved-text saved-text-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                handleTap(p.text);
                              }}
                            >
                              {p.text}
                            </button>
                          </label>
                          <button
                            type="button"
                            className="btn btn-accent saved-row-action-btn"
                            onClick={() => onPickPhrase(p)}
                          >
                            <PenLine size={16} aria-hidden="true" /> Practise
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
                );
              })}
            </div>
          </>
        )}
        {savedPhrases.length === 0 && (
          <button type="button" className="btn btn-primary" onClick={onGoToReader}>
            Go to Reader
          </button>
        )}

        {inlineDetail && dict && (
          <WordDetailPanel
            text={inlineDetail.text}
            pinyin={inlineDetail.pinyin}
            meanings={inlineDetail.meanings}
            dict={dict}
            onClose={() => setInlineDetail(null)}
          />
        )}
      </div>
    );
  }

  return (
    <QuizSession
      key={phrase.id}
      chars={uniqueChineseChars(phrase.text).map((char) => ({ char }))}
      phraseId={phrase.id}
      fallbackSubtitle={`from "${phrase.text}"`}
      emptyMessage={`"${phrase.text}" doesn't contain any Chinese characters to practice.`}
      onExit={() => onPickPhrase(null)}
    />
  );
}

interface QuizResult {
  char: string;
  correct: boolean;
  mistakes: number;
}

interface QuizSessionProps {
  chars: PracticeChar[];
  phraseId: string;
  fallbackSubtitle: string;
  emptyMessage: string;
  onExit: () => void;
}

function QuizSession({ chars, phraseId, fallbackSubtitle, emptyMessage, onExit }: QuizSessionProps) {
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [strokesLeft, setStrokesLeft] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  // Set when a character's stroke data fails to load (e.g. a rare character
  // missing from the bundled dataset) — surfaced instead of leaving the
  // practice canvas stuck blank forever waiting on data that'll never arrive.
  const [loadErrorChar, setLoadErrorChar] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  // Guards the quiz callbacks below against firing after this effect's own
  // cleanup (character/phrase changed, or the component unmounted).
  const cancelledRef = useRef(false);
  // HanziWriter's onLoadCharDataError is registered once (see below) and its
  // closure would otherwise always see the character from that first render;
  // this ref keeps it pointed at whichever character is current.
  const currentCharRef = useRef('');

  const finished = index >= chars.length;
  const currentChar = chars[index]?.char ?? '';
  const currentGroupLabel = chars[index]?.groupLabel;
  const speechSupported = isSpeechSupported();
  const summarySoundPlayedRef = useRef(false);

  // Same three-tier sound as Test mode, based on the fraction of characters
  // written with zero mistakes: 100% celebratory, 50-99% "good effort",
  // below 50% the gentler "keep trying" sound. Guarded by a ref (not just
  // `finished`) so it fires once per attempt, not on every re-render of the
  // summary screen.
  useEffect(() => {
    if (!finished || summarySoundPlayedRef.current || results.length === 0) return;
    summarySoundPlayedRef.current = true;
    const correctCount = results.filter((r) => r.correct).length;
    playSummarySound(pickSummarySoundFile(correctCount / results.length));
  }, [finished, results]);

  function startQuiz() {
    setMistakes(0);
    setStrokesLeft(null);
    writerRef.current!.quiz({
      showHintAfterMisses: 3,
      onMistake: (strokeData) => {
        if (cancelledRef.current) return;
        setMistakes(strokeData.totalMistakes);
      },
      onCorrectStroke: (strokeData) => {
        if (cancelledRef.current) return;
        setStrokesLeft(strokeData.strokesRemaining);
      },
      onComplete: (summary) => {
        if (cancelledRef.current) return;
        const correct = summary.totalMistakes === 0;
        recordTestAttempt({
          phraseId,
          char: summary.character,
          correct,
          mistakes: summary.totalMistakes,
          attemptedAt: Date.now(),
        });
        setResults((prev) => [...prev, { char: summary.character, correct, mistakes: summary.totalMistakes }]);
        setTimeout(() => setIndex((i) => i + 1), 1100);
      },
    });
  }

  useEffect(() => {
    if (finished || !containerRef.current) return;
    cancelledRef.current = false;
    currentCharRef.current = currentChar;
    setLoadErrorChar(null);

    if (!writerRef.current) {
      writerRef.current = HanziWriter.create(containerRef.current, currentChar, {
        width: 260,
        height: 260,
        padding: 16,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200,
        charDataLoader: hanziCharDataLoader,
        onLoadCharDataError: () => {
          if (cancelledRef.current) return;
          setLoadErrorChar(currentCharRef.current);
        },
      });
      startQuiz();
    } else {
      writerRef.current.setCharacter(currentChar).then(() => {
        if (!cancelledRef.current) startQuiz();
      });
    }

    return () => {
      cancelledRef.current = true;
      writerRef.current?.cancelQuiz();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, currentChar, phraseId]);

  // A character with no usable stroke data can't be practiced — skip it
  // automatically instead of leaving the quiz stuck on a blank canvas.
  useEffect(() => {
    if (loadErrorChar !== currentChar) return;
    const timer = setTimeout(() => {
      if (!cancelledRef.current) setIndex((i) => i + 1);
    }, 1600);
    return () => clearTimeout(timer);
  }, [loadErrorChar, currentChar]);

  async function handleShowMe() {
    if (!writerRef.current || isAnimating) return;
    setIsAnimating(true);
    writerRef.current.cancelQuiz();
    // animateCharacter()'s own return value resolves once the animation
    // *starts*, not when it finishes, so its onComplete callback is the
    // only reliable "the demo is actually done" signal.
    await new Promise<void>((resolve) => {
      writerRef.current!.animateCharacter({ onComplete: () => resolve() });
    });
    setIsAnimating(false);
    // The demo can outlive a character/phrase change (or Stop being tapped)
    // if it's mid-animation, so don't resurrect a quiz for a stale card.
    if (cancelledRef.current) return;
    // Re-set the (same) character rather than calling .quiz() directly on
    // the same instance — this is the exact path already used when moving
    // between characters, and it's what actually resets the writer into a
    // clean, interactive state after the demo animation leaves it showing
    // a fully-drawn character.
    await writerRef.current.setCharacter(currentChar);
    if (!cancelledRef.current) startQuiz();
  }

  if (chars.length === 0) {
    return (
      <div className="test-session">
        <p className="empty-state">{emptyMessage}</p>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          Choose another phrase
        </button>
      </div>
    );
  }

  if (finished) {
    const correctCount = results.filter((r) => r.correct).length;
    return (
      <div className="test-session test-summary">
        <h2 className="icon-inline">
          <PartyPopper size={22} aria-hidden="true" /> Great job!
        </h2>
        <p className="score-line">
          {correctCount} / {results.length} written perfectly (no mistakes)
        </p>
        <ul className="summary-list">
          {results.map((r, i) => (
            <li key={i} className={r.correct ? 'summary-correct' : 'summary-wrong'}>
              <span className="summary-char">{r.char}</span>
              <span className="icon-inline">
                {r.correct ? (
                  <>
                    <CheckCircle2 size={16} aria-hidden="true" /> Perfect
                  </>
                ) : (
                  `${r.mistakes} mistake${r.mistakes === 1 ? '' : 's'}`
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="test-summary-actions">
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              // The hanzi-target container div only exists in the
              // in-progress quiz view, not this summary screen, so it
              // unmounted when the quiz finished — but writerRef (a plain
              // ref) still points at the now-detached HanziWriter instance
              // bound to that old DOM node. Clearing it forces the effect
              // below to create a fresh instance against the div that
              // remounts once index resets, instead of silently drawing
              // into an element that's no longer on screen.
              writerRef.current = null;
              summarySoundPlayedRef.current = false;
              setResults([]);
              setIndex(0);
            }}
          >
            Practise again
          </button>
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Choose another phrase
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-session">
      <div className="recall-session-header">
        <div className="test-progress">
          Character {index + 1} of {chars.length} — {currentGroupLabel ?? fallbackSubtitle}
        </div>
        <button type="button" className="icon-btn recall-stop-btn" onClick={onExit} aria-label="Stop practising">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div ref={containerRef} className="hanzi-target" />
      {loadErrorChar === currentChar && (
        <p className="hint-text">Couldn't load stroke data for "{currentChar}" — skipping to the next one…</p>
      )}
      <div className="test-status">
        {mistakes > 0 && <span className="mistake-count">Mistakes so far: {mistakes}</span>}
        {strokesLeft !== null && strokesLeft > 0 && <span>{strokesLeft} stroke(s) left</span>}
      </div>
      <div className="test-toolbar">
        <button type="button" className="btn btn-ghost" onClick={() => speak(currentChar)} disabled={!speechSupported}>
          <Volume2 size={18} aria-hidden="true" /> Hear it
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void handleShowMe()} disabled={isAnimating}>
          <Sparkles size={18} aria-hidden="true" /> Show me how
        </button>
      </div>
    </div>
  );
}
