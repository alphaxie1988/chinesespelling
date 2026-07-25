import { pinyin } from 'pinyin-pro';
import type { AnnotatedSegment, Dictionary } from '../types';

// Longest dictionary entry (in characters) that segmentation will try to
// match. CC-CEDICT has a handful of much longer idiom/name entries, but
// capping this keeps forward-maximum-matching fast and those extreme
// outliers aren't the kind of vocabulary a primary-school app needs whole.
const MAX_WORD_LEN = 8;

export function isChineseChar(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4dbf) || // Extension A
    (cp >= 0x20000 && cp <= 0x2a6df) || // Extension B (surrogate pair)
    (cp >= 0xf900 && cp <= 0xfaff) // Compatibility ideographs
  );
}

/**
 * Splits raw pasted text into Chinese words (matched greedily against the
 * dictionary's own key list, i.e. forward maximum matching) and runs of
 * non-Chinese text (punctuation, spaces, digits, latin letters) that are
 * shown as-is without pinyin or a tap-to-reveal meaning.
 *
 * Pinyin is generated once for the whole input (so pinyin-pro can use
 * surrounding context to pick the right reading for polyphonic characters,
 * e.g. 银行 -> háng not xíng) and then re-grouped to match each segment.
 */
export function segmentAndAnnotate(text: string, dict: Dictionary): AnnotatedSegment[] {
  const chars = Array.from(text);
  if (chars.length === 0) return [];

  const charPinyin = pinyin(text, { toneType: 'symbol', type: 'array' }) as string[];

  const segments: AnnotatedSegment[] = [];
  let i = 0;

  while (i < chars.length) {
    if (!isChineseChar(chars[i])) {
      let j = i + 1;
      while (j < chars.length && !isChineseChar(chars[j])) j++;
      segments.push({
        text: chars.slice(i, j).join(''),
        isChinese: false,
        pinyin: null,
        meanings: null,
      });
      i = j;
      continue;
    }

    let matchedLen = 1;
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (dict[candidate]) {
        matchedLen = len;
        break;
      }
    }

    const word = chars.slice(i, i + matchedLen).join('');
    segments.push({
      text: word,
      isChinese: true,
      pinyin: charPinyin.slice(i, i + matchedLen).join(' '),
      meanings: dict[word] ?? null,
    });
    i += matchedLen;
  }

  return segments;
}
