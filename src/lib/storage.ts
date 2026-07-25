import type { RecallAttemptRecord, SavedPhrase, TestAttemptRecord } from '../types';

// Everything lives in localStorage — no accounts, no backend, no sync.
// Data stays on this one device/browser (per the local-only v1 scope).

const PHRASES_KEY = 'cs.savedPhrases.v1';
const ATTEMPTS_KEY = 'cs.testAttempts.v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted/foreign data in the key — don't crash the app over it.
    return fallback;
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSavedPhrases(): SavedPhrase[] {
  return safeParse<SavedPhrase[]>(localStorage.getItem(PHRASES_KEY), []);
}

export function savePhrase(text: string): SavedPhrase {
  const trimmed = text.trim();
  const phrases = getSavedPhrases();

  // Re-saving the same text bumps it to the top instead of creating a
  // duplicate entry in the list.
  const existing = phrases.find((p) => p.text === trimmed);
  if (existing) {
    const rest = phrases.filter((p) => p.id !== existing.id);
    const bumped = { ...existing, createdAt: Date.now() };
    localStorage.setItem(PHRASES_KEY, JSON.stringify([bumped, ...rest]));
    return bumped;
  }

  const phrase: SavedPhrase = { id: newId(), text: trimmed, createdAt: Date.now() };
  localStorage.setItem(PHRASES_KEY, JSON.stringify([phrase, ...phrases]));
  return phrase;
}

export function deleteSavedPhrase(id: string): void {
  const phrases = getSavedPhrases().filter((p) => p.id !== id);
  localStorage.setItem(PHRASES_KEY, JSON.stringify(phrases));
}

export function getTestAttempts(): TestAttemptRecord[] {
  return safeParse<TestAttemptRecord[]>(localStorage.getItem(ATTEMPTS_KEY), []);
}

export function recordTestAttempt(record: TestAttemptRecord): void {
  const attempts = getTestAttempts();
  // Cap history length so localStorage doesn't grow unbounded over months of use.
  const trimmed = [record, ...attempts].slice(0, 2000);
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(trimmed));
}

const RECALL_KEY = 'cs.recallAttempts.v1';

export function getRecallAttempts(): RecallAttemptRecord[] {
  return safeParse<RecallAttemptRecord[]>(localStorage.getItem(RECALL_KEY), []);
}

export function recordRecallAttempt(record: RecallAttemptRecord): void {
  const attempts = getRecallAttempts();
  const trimmed = [record, ...attempts].slice(0, 2000);
  localStorage.setItem(RECALL_KEY, JSON.stringify(trimmed));
}

export interface CharacterStat {
  char: string;
  attempts: number;
  correct: number;
}

export function getCharacterStats(): CharacterStat[] {
  const byChar = new Map<string, CharacterStat>();
  for (const a of getTestAttempts()) {
    const stat = byChar.get(a.char) ?? { char: a.char, attempts: 0, correct: 0 };
    stat.attempts += 1;
    if (a.correct) stat.correct += 1;
    byChar.set(a.char, stat);
  }
  return Array.from(byChar.values()).sort((a, b) => a.correct / a.attempts - b.correct / b.attempts);
}
