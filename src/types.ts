// A word/phrase -> list of English definitions (short senses, kid-friendly order).
export type Dictionary = Record<string, string[]>;

// One chunk of the original pasted text after segmentation: either a
// Chinese word/character (annotated with pinyin + meaning) or a run of
// non-Chinese text (punctuation, spaces, latin/digits) shown as-is.
export interface AnnotatedSegment {
  text: string;
  isChinese: boolean;
  pinyin: string | null;
  meanings: string[] | null;
}

export interface SavedPhrase {
  id: string;
  text: string;
  createdAt: number;
}

export interface TestAttemptRecord {
  phraseId: string;
  char: string;
  correct: boolean;
  mistakes: number;
  attemptedAt: number;
}

export interface RecallAttemptRecord {
  cardId: string;
  text: string;
  know: boolean;
  attemptedAt: number;
}

// Character decomposition + etymology data (from the Make Me a Hanzi
// project) used to generate "creative way to remember" mnemonics.
// d = decomposition (IDS string), h = human-written etymology hint,
// t = etymology type (pictographic/ideographic/pictophonetic).
export type DecompositionData = Record<string, { d?: string; h?: string; t?: string }>;

export type ViewName = 'reader' | 'saved' | 'test' | 'recall' | 'progress';
