// Build-time script: parses Tatoeba's Mandarin sentence export into a
// word -> example-sentences index, used to show "sample sentences" in the
// word detail panel.
//
// Source: Tatoeba Project (https://tatoeba.org), CC BY 2.0 FR. See
// scripts/raw/tatoeba_cmn_sentences.tsv (downloaded from
// https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2
// and decompressed — Node has no built-in bzip2 support, so this script
// expects the plain .tsv, not the .bz2 archive).
//
// Run with: node scripts/build-examples.mjs
// (requires public/dict/cedict.json to already exist — run build-dict.mjs first)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CEDICT_RAW = join(__dirname, 'raw/cedict_ts.u8');
const SENTENCES_SRC = join(__dirname, 'raw/tatoeba_cmn_sentences.tsv');
const DICT_JSON = join(__dirname, '../public/dict/cedict.json');
const OUT = join(__dirname, '../public/dict/examples.json');

const MAX_WORD_LEN = 8; // matches src/lib/segment.ts's forward-max-match cap
const MAX_EXAMPLES_PER_WORD = 2;
const MIN_SENTENCE_LEN = 4;
const MAX_SENTENCE_LEN = 26;

const dict = JSON.parse(readFileSync(DICT_JSON, 'utf8'));

// Tatoeba's "cmn" sentences are a mix of Simplified and Traditional Chinese,
// but this app's dictionary/segmentation is Simplified-only — a sentence
// containing even one Traditional-only glyph would show a kid an unfamiliar
// character. CC-CEDICT's own traditional/simplified word pairs give us a
// reliable single-character mapping to filter those out: for any cedict
// line where both the traditional and simplified headword are exactly one
// character and they differ, that traditional character never legitimately
// appears in Simplified text.
const cedictRaw = readFileSync(CEDICT_RAW, 'utf8');
const LINE_RE = /^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+)\/$/;
const traditionalOnlyChars = new Set();
for (const line of cedictRaw.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const m = LINE_RE.exec(line);
  if (!m) continue;
  const [, traditional, simplified] = m;
  if ([...traditional].length === 1 && [...simplified].length === 1 && traditional !== simplified) {
    traditionalOnlyChars.add(traditional);
  }
}

function isUsableSentence(text) {
  const chars = [...text];
  if (chars.length < MIN_SENTENCE_LEN || chars.length > MAX_SENTENCE_LEN) return false;
  return chars.every((c) => !traditionalOnlyChars.has(c));
}

/** @type {Map<string, string[]>} */
const examples = new Map();

const sentencesRaw = readFileSync(SENTENCES_SRC, 'utf8');
let scanned = 0;
let usable = 0;

for (const line of sentencesRaw.split(/\r?\n/)) {
  if (!line) continue;
  const tab1 = line.indexOf('\t');
  const tab2 = line.indexOf('\t', tab1 + 1);
  if (tab1 === -1 || tab2 === -1) continue;
  const text = line.slice(tab2 + 1).trim();
  if (!text) continue;
  scanned++;
  if (!isUsableSentence(text)) continue;
  usable++;

  // Forward-maximum-matching against our own dictionary's key set — same
  // approach segmentAndAnnotate() uses at runtime — to find which real
  // words this sentence contains, so we know which words to file it under.
  const chars = [...text];
  let i = 0;
  while (i < chars.length) {
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i);
    let matchedLen = 0;
    for (let len = maxLen; len >= 1; len--) {
      const candidate = chars.slice(i, i + len).join('');
      if (dict[candidate]) {
        matchedLen = len;
        break;
      }
    }
    if (matchedLen > 0) {
      const word = chars.slice(i, i + matchedLen).join('');
      const list = examples.get(word);
      if (list) {
        if (list.length < MAX_EXAMPLES_PER_WORD && !list.includes(text)) list.push(text);
      } else {
        examples.set(word, [text]);
      }
      i += matchedLen;
    } else {
      i += 1;
    }
  }
}

// Shorter sentences first within each word's list — easier reading for a
// primary-school kid, and already capped to MAX_EXAMPLES_PER_WORD above.
for (const list of examples.values()) {
  list.sort((a, b) => a.length - b.length);
}

/** @type {Record<string, string[]>} */
const out = {};
for (const [word, list] of examples) out[word] = list;

writeFileSync(OUT, JSON.stringify(out));

console.log(`Scanned ${scanned} sentences, ${usable} usable (Simplified-only, length ${MIN_SENTENCE_LEN}-${MAX_SENTENCE_LEN}).`);
console.log(`Indexed example sentences for ${examples.size} words (out of ${Object.keys(dict).length} dictionary entries).`);
console.log(`Wrote ${OUT}`);
