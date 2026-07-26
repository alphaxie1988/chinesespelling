// Build-time script: parses the raw CC-CEDICT data file into a compact JSON
// dictionary used at runtime for definition lookups and (via its key list)
// forward-maximum-matching word segmentation.
//
// Source data: CC-CEDICT (https://cc-cedict.org/), published by MDBG,
// licensed under CC BY-SA 4.0. See scripts/raw/cedict_ts.u8 for the header.
//
// Run with: node scripts/build-dict.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'raw/cedict_ts.u8');
const OUT = join(__dirname, '../public/dict/cedict.json');

const LINE_RE = /^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+)\/$/;

const raw = readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/);

/** @type {Map<string, { defs: string[] }>} */
const dict = new Map();

let parsed = 0;
for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const m = LINE_RE.exec(line);
  if (!m) continue;
  const [, , simplified, , defsRaw] = m;

  const defs = defsRaw
    .split('/')
    .map((d) => d.trim())
    .filter(Boolean)
    // Classifier annotations ("CL:個|个[ge4]") aren't useful English meanings
    // for a primary-school reader, so drop them.
    .filter((d) => !d.startsWith('CL:'))
    // Cross-reference / variant notices ("see also 別的|别的[bie2 de5]") are
    // noisy for kids; skip them too.
    .filter((d) => !d.startsWith('see also') && !d.startsWith('variant of') && !d.startsWith('old variant of'))
    // Catches remaining self-referential glosses these prefix checks miss
    // (e.g. "used in 㐖毒[xie2 du2]") — a definition that just repeats the
    // headword itself isn't a meaning, it's a pointer to a different entry.
    .filter((d) => !d.includes(simplified));

  // Still register the word (with no defs) even if every gloss got filtered
  // out above, so forward-maximum-match segmentation still recognizes it as
  // a real word — the app falls back to showing pinyin for these at runtime.
  const existing = dict.get(simplified);
  if (existing) {
    for (const d of defs) {
      if (!existing.defs.includes(d)) existing.defs.push(d);
    }
  } else {
    dict.set(simplified, { defs });
  }
  parsed++;
}

/** @type {Record<string, string[]>} */
const out = {};
for (const [word, entry] of dict) {
  // Cap definitions per word so the JSON stays lean; a primary-school app
  // doesn't need the 6th obscure classical-literature sense of a word.
  out[word] = entry.defs.slice(0, 5);
}

writeFileSync(OUT, JSON.stringify(out));

const maxWordLen = Math.max(...Array.from(dict.keys(), (k) => [...k].length));

console.log(`Parsed ${parsed} raw entries into ${dict.size} unique words.`);
console.log(`Max word length: ${maxWordLen} characters.`);
console.log(`Wrote ${OUT}`);
