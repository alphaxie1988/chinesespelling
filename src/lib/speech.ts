// Thin wrapper around the browser's built-in Web Speech API so the rest of
// the app doesn't need to know about voice loading quirks. No network calls,
// no API key, no cost — quality depends on the voices the OS/browser ships.

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Chrome (and some other browsers) load voices asynchronously and fire
 * `voiceschanged` once they're ready; on first page load `getVoices()` can
 * return an empty array right up until that event fires. Call this once on
 * app start so voices are warm by the time the user taps a speak button.
 */
export function primeVoices(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
}

function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === 'zh-CN') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('zh')) ??
    null
  );
}

export function hasZhVoice(): boolean {
  if (!isSpeechSupported()) return false;
  return pickZhVoice() !== null;
}

export function speak(text: string, rate = 0.85, onEnd?: () => void, onBoundary?: (charIndex: number) => void): boolean {
  if (!isSpeechSupported() || !text.trim()) return false;

  // Cancel any utterance already in flight so rapid taps don't queue up and
  // read words out of order.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickZhVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'zh-CN';
  utterance.rate = rate;
  if (onEnd) {
    // Fires for a natural finish (onend) as well as being interrupted by
    // cancel()/an error (onerror) — either way playback has stopped.
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  if (onBoundary) {
    utterance.onboundary = (e) => onBoundary(e.charIndex);
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
