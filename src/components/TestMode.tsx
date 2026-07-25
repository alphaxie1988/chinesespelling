import { useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Bookmark, CheckCircle2, PartyPopper, PenLine, Sparkles, Volume2 } from 'lucide-react';
import { isChineseChar } from '../lib/segment';
import { hanziCharDataLoader } from '../lib/hanziData';
import { speak, isSpeechSupported } from '../lib/speech';
import { recordTestAttempt } from '../lib/storage';
import type { SavedPhrase } from '../types';

interface TestModeProps {
  savedPhrases: SavedPhrase[];
  phrase: SavedPhrase | null;
  onPickPhrase: (phrase: SavedPhrase | null) => void;
  onGoToReader: () => void;
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

export function TestMode({ savedPhrases, phrase, onPickPhrase, onGoToReader }: TestModeProps) {
  if (!phrase) {
    return (
      <div className="test-picker">
        <h2>Choose a phrase to practice writing</h2>
        {savedPhrases.length === 0 ? (
          <p className="empty-state">
            No saved phrases yet. Go to <strong>Reader</strong>, paste a phrase, and tap{' '}
            <span className="icon-inline">
              <Bookmark size={14} aria-hidden="true" /> Save to my list
            </span>{' '}
            first.
          </p>
        ) : (
          <ul className="saved-list">
            {savedPhrases.map((p) => (
              <li key={p.id} className="saved-row">
                <span className="saved-text">{p.text}</span>
                <button type="button" className="btn btn-accent" onClick={() => onPickPhrase(p)}>
                  <PenLine size={16} aria-hidden="true" /> Test
                </button>
              </li>
            ))}
          </ul>
        )}
        {savedPhrases.length === 0 && (
          <button type="button" className="btn btn-primary" onClick={onGoToReader}>
            Go to Reader
          </button>
        )}
      </div>
    );
  }

  return <QuizSession key={phrase.id} phrase={phrase} onExit={() => onPickPhrase(null)} />;
}

interface QuizResult {
  char: string;
  correct: boolean;
  mistakes: number;
}

function QuizSession({ phrase, onExit }: { phrase: SavedPhrase; onExit: () => void }) {
  const chars = useMemo(() => uniqueChineseChars(phrase.text), [phrase.text]);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [strokesLeft, setStrokesLeft] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const finished = index >= chars.length;
  const currentChar = chars[index];
  const speechSupported = isSpeechSupported();

  useEffect(() => {
    if (finished || !containerRef.current) return;
    let cancelled = false;
    setMistakes(0);
    setStrokesLeft(null);

    function startQuiz() {
      writerRef.current!.quiz({
        showHintAfterMisses: 3,
        onMistake: (strokeData) => {
          if (cancelled) return;
          setMistakes(strokeData.totalMistakes);
        },
        onCorrectStroke: (strokeData) => {
          if (cancelled) return;
          setStrokesLeft(strokeData.strokesRemaining);
        },
        onComplete: (summary) => {
          if (cancelled) return;
          const correct = summary.totalMistakes === 0;
          recordTestAttempt({
            phraseId: phrase.id,
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

    if (!writerRef.current) {
      writerRef.current = HanziWriter.create(containerRef.current, currentChar, {
        width: 260,
        height: 260,
        padding: 16,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200,
        charDataLoader: hanziCharDataLoader,
      });
      startQuiz();
    } else {
      writerRef.current.setCharacter(currentChar).then(() => {
        if (!cancelled) startQuiz();
      });
    }

    return () => {
      cancelled = true;
      writerRef.current?.cancelQuiz();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, currentChar, phrase.id]);

  function handleShowMe() {
    writerRef.current?.animateCharacter();
  }

  if (chars.length === 0) {
    return (
      <div className="test-session">
        <p className="empty-state">"{phrase.text}" doesn't contain any Chinese characters to practice.</p>
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
              setResults([]);
              setIndex(0);
            }}
          >
            Test again
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
      <div className="test-progress">
        Character {index + 1} of {chars.length} — from "{phrase.text}"
      </div>
      <div ref={containerRef} className="hanzi-target" />
      <div className="test-status">
        {mistakes > 0 && <span className="mistake-count">Mistakes so far: {mistakes}</span>}
        {strokesLeft !== null && strokesLeft > 0 && <span>{strokesLeft} stroke(s) left</span>}
      </div>
      <div className="test-toolbar">
        <button type="button" className="btn btn-ghost" onClick={() => speak(currentChar)} disabled={!speechSupported}>
          <Volume2 size={18} aria-hidden="true" /> Hear it
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleShowMe}>
          <Sparkles size={18} aria-hidden="true" /> Show me how
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          Stop test
        </button>
      </div>
    </div>
  );
}
