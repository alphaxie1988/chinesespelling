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

// Short, kid-friendly meanings for the combining radical forms above.
// CC-CEDICT's own entry for these is either missing, a long "___ radical in
// Chinese characters (Kangxi radical N), occurring in ..." description, or
// — via the standalone-character alias — lists an unrelated "surname X"
// sense first (CEDICT sorts common surnames before the ordinary meaning for
// several of these: 水/火/金/刀 all open with "surname ..."). None of those
// are useful to show a kid trying to recognize the shared pattern, so these
// take priority over any dictionary lookup.
const RADICAL_MEANINGS: Record<string, string> = {
  亻: 'person',
  彳: 'step/walk',
  氵: 'water',
  扌: 'hand',
  灬: 'fire',
  讠: 'speech',
  饣: 'food',
  钅: 'metal',
  纟: 'silk/thread',
  忄: 'heart',
  礻: 'spirit/ritual',
  衤: 'clothes',
  辶: 'walk',
  阝: 'mound/city',
  艹: 'grass/plant',
  '⺮': 'bamboo',
  犭: 'animal',
  刂: 'knife',
  '⺈': 'knife',
  '⻌': 'walk',
};

function componentMeaning(component: string, dict: Dictionary): string | null {
  const curated = RADICAL_MEANINGS[component];
  if (curated) return curated;
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

export interface RadicalGroup {
  component: string;
  /** e.g. "氵 (water)" — falls back to the bare component if it (or its
   * standalone-character alias) has no dictionary gloss to show. */
  label: string;
  chars: string[];
}

/**
 * Groups characters from `chars` by a structural component they share with
 * at least one other character in the same list — e.g. every saved word
 * containing 氵 (water) ends up in one group — so practising them
 * back-to-back makes the shared pattern visible instead of drilling each
 * character in isolation. A character with no such sibling here is left out
 * entirely: the point is comparison, and a solo character has nothing to
 * compare against. Groups are returned largest-first, since a bigger shared
 * group is a clearer, more useful pattern to notice.
 */
export function groupCharsByComponent(chars: string[], decomp: DecompositionData, dict: Dictionary): RadicalGroup[] {
  const byComponent = new Map<string, string[]>();
  for (const char of chars) {
    const entry = decomp[char];
    if (!entry?.d) continue;
    // A character whose own decomposition repeats a component (e.g. 林 is
    // 木 + 木) must only count once per component here — otherwise it'd show
    // up twice in that component's group.
    for (const component of new Set(parseComponents(entry.d, char))) {
      const list = byComponent.get(component);
      if (list) list.push(char);
      else byComponent.set(component, [char]);
    }
  }

  // Largest groups claim their characters first — a character that could
  // fit more than one group (it shares two different components with
  // different siblings) ends up wherever the pattern is most visible,
  // instead of splintering into several near-empty groups.
  const candidates = Array.from(byComponent.entries())
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  const assigned = new Set<string>();
  const groups: RadicalGroup[] = [];
  for (const [component, group] of candidates) {
    const remaining = group.filter((c) => !assigned.has(c));
    if (remaining.length < 2) continue;
    remaining.forEach((c) => assigned.add(c));
    const meaning = componentMeaning(component, dict);
    groups.push({
      component,
      label: meaning ? `${component} (${meaning})` : component,
      chars: remaining,
    });
  }
  return groups;
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
