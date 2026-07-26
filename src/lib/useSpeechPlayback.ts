import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking } from './speech';

// How often to refresh highlightIndex while actively speaking. Frequent
// enough that word-by-word highlighting reads as smooth, not choppy.
const HIGHLIGHT_POLL_MS = 120;

// Starting guess for how long one character takes to speak at 1.0x, before
// any real data is available. Deliberately on the faster side (most Chinese
// TTS voices read closer to 4-5 chars/sec than 3) since a too-slow guess is
// exactly what makes read-along highlighting visibly lag the audio.
const INITIAL_MS_PER_CHAR = 230;

/**
 * Play/pause/continue for a single passage of text, backed by the Web
 * Speech API. speechSynthesis.resume() is unreliable across browsers/OSes
 * once paused (a long-standing platform bug — it looks like it should work
 * but silently never resumes), so pausing actually cancels the utterance
 * and continuing re-speaks just the remaining text. Some voices don't fire
 * onboundary for Chinese at all, so position (for both resuming after a
 * pause and read-along highlighting) falls back to an elapsed-time
 * estimate — self-calibrating from how long each utterance actually took to
 * finish, since the right speed varies by voice/browser/OS and there's no
 * way to know it in advance.
 */
export function useSpeechPlayback() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Absolute character index (within the full text passed to play()) that's
  // currently being spoken — for read-along highlighting. -1 when idle.
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Each play() call bumps this so a stale onEnd from an utterance that was
  // interrupted by a newer one (cancel() fires its onerror) can't clobber
  // isSpeaking for the utterance that's actually playing now.
  const speechGenRef = useRef(0);
  // Absolute offset (within the full text) where the utterance currently
  // playing begins, and how far into *that* utterance onboundary has
  // reported reaching — together these say exactly where to pick back up.
  const offsetRef = useRef(0);
  const boundaryRef = useRef(0);
  const playStartRef = useRef(0);
  const rateAtPlayRef = useRef(1);
  const pausedAtRef = useRef(0);
  const textRef = useRef('');
  // Learned ms-per-character at 1.0x, refined after every utterance that
  // actually finishes on its own (not one that got cancelled/interrupted,
  // which wouldn't reflect its true full duration).
  const msPerCharRef = useRef(INITIAL_MS_PER_CHAR);

  function play(text: string, rate: number, offset = 0) {
    if (!text.trim()) return;
    textRef.current = text;
    const gen = ++speechGenRef.current;
    offsetRef.current = offset;
    boundaryRef.current = 0;
    playStartRef.current = Date.now();
    rateAtPlayRef.current = rate;
    setIsPaused(false);
    setHighlightIndex(offset);
    const spokenLength = text.length - offset;
    const started = speak(
      text.slice(offset),
      rate,
      (naturalFinish) => {
        if (speechGenRef.current !== gen) return;
        if (naturalFinish && spokenLength > 0 && boundaryRef.current === 0) {
          // Only calibrate off the elapsed-time path — if onboundary fired
          // for this utterance, elapsed time was never driving the estimate
          // for it, so timing it wouldn't measure the same thing.
          const elapsedMs = Date.now() - playStartRef.current;
          const observedMsPerChar = (elapsedMs / spokenLength) * rate;
          // Blend rather than replace outright, so one oddly-timed read
          // (e.g. this tab was backgrounded mid-utterance) can't swing the
          // estimate too far in one shot.
          msPerCharRef.current = msPerCharRef.current * 0.5 + observedMsPerChar * 0.5;
        }
        setIsSpeaking(false);
        setHighlightIndex(-1);
      },
      (charIndex) => {
        if (speechGenRef.current === gen) boundaryRef.current = charIndex;
      },
    );
    setIsSpeaking(started);
  }

  // bias <1 deliberately under-estimates (used when resuming after a pause,
  // where guessing too far ahead would skip content the user never heard);
  // bias 1 is the plain best-guess (used for live highlighting, where
  // running behind the audio the whole time reads as obviously laggy).
  function estimateCharsSpoken(remainingLength: number, bias: number): number {
    if (boundaryRef.current > 0) return boundaryRef.current;
    const elapsedMs = Date.now() - playStartRef.current;
    const estimated = Math.floor((elapsedMs / (msPerCharRef.current / rateAtPlayRef.current)) * bias);
    return Math.max(0, Math.min(estimated, Math.max(0, remainingLength - 1)));
  }

  function togglePause(rate: number) {
    if (!isSpeaking) return;
    if (isPaused) {
      play(textRef.current, rate, pausedAtRef.current);
    } else {
      const remainingLength = textRef.current.length - offsetRef.current;
      pausedAtRef.current = offsetRef.current + estimateCharsSpoken(remainingLength, 0.85);
      speechGenRef.current++; // invalidates the stale onEnd that cancel() below triggers
      stopSpeaking();
      setIsPaused(true);
    }
  }

  // Advances highlightIndex while actively speaking, using the same
  // best-available estimate (real onboundary data when the voice provides
  // it, else the calibrated elapsed-time guess) — so read-along highlighting
  // works on every voice, not just ones that fire boundary events, at the
  // cost of sometimes drifting a bit on longer sentences. Frozen (not
  // cleared) while paused, so the last-highlighted word stays visible
  // instead of disappearing.
  useEffect(() => {
    if (!isSpeaking || isPaused) return;
    const interval = setInterval(() => {
      const remainingLength = textRef.current.length - offsetRef.current;
      setHighlightIndex(offsetRef.current + estimateCharsSpoken(remainingLength, 1));
    }, HIGHLIGHT_POLL_MS);
    return () => clearInterval(interval);
  }, [isSpeaking, isPaused]);

  return { isSpeaking, isPaused, highlightIndex, play, togglePause };
}
