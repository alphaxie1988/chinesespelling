import type { DecompositionData, Dictionary } from '../types';

let decompPromise: Promise<DecompositionData> | null = null;

// Character decomposition/etymology data (~9.5k characters, ~590KB) fetched
// once and reused, same lazy-load pattern as the CC-CEDICT dictionary.
export function loadDecomposition(): Promise<DecompositionData> {
  if (!decompPromise) {
    decompPromise = fetch(`${import.meta.env.BASE_URL}dict/decomposition.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load decomposition data (HTTP ${res.status})`);
        return res.json() as Promise<DecompositionData>;
      })
      .catch((err) => {
        decompPromise = null;
        throw err;
      });
  }
  return decompPromise;
}

const IDC_START = 0x2ff0;
const IDC_END = 0x2fff;

function isIdc(char: string): boolean {
  const cp = char.codePointAt(0);
  return cp !== undefined && cp >= IDC_START && cp <= IDC_END;
}

function parseComponents(decomposition: string, self: string): string[] {
  return Array.from(decomposition).filter((c) => !isIdc(c) && c !== '？' && c !== self);
}

// Common simplified/traditional radical forms don't always have their own
// CC-CEDICT entry (e.g. 氵 "water radical" vs the standalone character 水),
// so this maps the combining form to the standalone character whose meaning
// we can look up instead.
const RADICAL_ALIASES: Record<string, string> = {
  亻: '人',
  彳: '行',
  氵: '水',
  扌: '手',
  灬: '火',
  讠: '言',
  饣: '食',
  钅: '金',
  纟: '糸',
  忄: '心',
  礻: '示',
  衤: '衣',
  辶: '辵',
  阝: '阜',
  艹: '艸',
  '⺮': '竹',
  犭: '犬',
  刂: '刀',
  '⺈': '刀',
  '⻌': '辵',
};

function componentMeaning(component: string, dict: Dictionary): string | null {
  const direct = dict[component];
  if (direct) return direct[0];
  const alias = RADICAL_ALIASES[component];
  if (alias) {
    const aliasMeaning = dict[alias];
    if (aliasMeaning) return aliasMeaning[0];
  }
  return null;
}

function fallbackMnemonic(char: string, decomp: DecompositionData, dict: Dictionary): string | null {
  const entry = decomp[char];
  if (!entry?.d) return null;
  const components = parseComponents(entry.d, char);
  if (components.length === 0) return null;

  const labeled = components.map((c) => {
    const meaning = componentMeaning(c, dict);
    return meaning ? `${c} (${meaning})` : c;
  });

  if (labeled.length === 1) {
    return `${char} is built from ${labeled[0]}.`;
  }
  return `${char} is built from ${labeled.join(' + ')} — picture them combined to help it stick!`;
}

/** A short mnemonic for one character, or null if we have nothing useful to say. */
export function getCharMnemonic(char: string, decomp: DecompositionData, dict: Dictionary): string | null {
  const entry = decomp[char];
  if (entry?.h) return entry.h;
  return fallbackMnemonic(char, decomp, dict);
}

export interface CharMnemonic {
  char: string;
  hint: string | null;
}

/** One mnemonic per unique Chinese character found in `text`, in first-seen order. */
export function getMnemonicsForText(
  text: string,
  decomp: DecompositionData,
  dict: Dictionary,
  isChineseChar: (char: string) => boolean,
): CharMnemonic[] {
  const seen = new Set<string>();
  const result: CharMnemonic[] = [];
  for (const char of Array.from(text)) {
    if (!isChineseChar(char) || seen.has(char)) continue;
    seen.add(char);
    result.push({ char, hint: getCharMnemonic(char, decomp, dict) });
  }
  return result;
}
