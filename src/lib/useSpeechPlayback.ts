import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking } from './speech';

// How often to refresh highlightIndex while actively speaking. Frequent
// enough that word-by-word highlighting reads as smooth, not choppy.
const HIGHLIGHT_POLL_MS = 120;

/**
 * Play/pause/continue for a single passage of text, backed by the Web
 * Speech API. speechSynthesis.resume() is unreliable across browsers/OSes
 * once paused (a long-standing platform bug — it looks like it should work
 * but silently never resumes), so pausing actually cancels the utterance
 * and continuing re-speaks just the remaining text. Some voices don't fire
 * onboundary for Chinese at all, so the resume position falls back to a
 * rough elapsed-time estimate (biased a bit short, so a wrong guess repeats
 * a beat of audio rather than skipping ahead and cutting off content).
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
    const started = speak(
      text.slice(offset),
      rate,
      () => {
        if (speechGenRef.current === gen) {
          setIsSpeaking(false);
          setHighlightIndex(-1);
        }
      },
      (charIndex) => {
        if (speechGenRef.current === gen) boundaryRef.current = charIndex;
      },
    );
    setIsSpeaking(started);
  }

  function estimateCharsSpoken(remainingLength: number): number {
    if (boundaryRef.current > 0) return boundaryRef.current;
    const BASE_MS_PER_CHAR = 330; // ~3 characters/sec at 1.0x, a rough Mandarin TTS pace
    const elapsedMs = Date.now() - playStartRef.current;
    const estimated = Math.floor((elapsedMs / (BASE_MS_PER_CHAR / rateAtPlayRef.current)) * 0.85);
    return Math.max(0, Math.min(estimated, Math.max(0, remainingLength - 1)));
  }

  function togglePause(rate: number) {
    if (!isSpeaking) return;
    if (isPaused) {
      play(textRef.current, rate, pausedAtRef.current);
    } else {
      const remainingLength = textRef.current.length - offsetRef.current;
      pausedAtRef.current = offsetRef.current + estimateCharsSpoken(remainingLength);
      speechGenRef.current++; // invalidates the stale onEnd that cancel() below triggers
      stopSpeaking();
      setIsPaused(true);
    }
  }

  // Advances highlightIndex while actively speaking, using the same
  // best-available estimate (real onboundary data when the voice provides
  // it, else the rough elapsed-time guess) that already backs pause/resume
  // — so read-along highlighting works on every voice, not just ones that
  // fire boundary events, at the cost of sometimes drifting a bit on longer
  // sentences. Frozen (not cleared) while paused, so the last-highlighted
  // word stays visible instead of disappearing.
  useEffect(() => {
    if (!isSpeaking || isPaused) return;
    const interval = setInterval(() => {
      const remainingLength = textRef.current.length - offsetRef.current;
      setHighlightIndex(offsetRef.current + estimateCharsSpoken(remainingLength));
    }, HIGHLIGHT_POLL_MS);
    return () => clearInterval(interval);
  }, [isSpeaking, isPaused]);

  return { isSpeaking, isPaused, highlightIndex, play, togglePause };
}
