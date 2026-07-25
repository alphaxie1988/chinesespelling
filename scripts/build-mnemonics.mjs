// Build-time script: parses the Make Me a Hanzi dictionary (character
// decomposition + human-written etymology hints) into a compact JSON asset
// used to generate "creative way to remember" mnemonics in Recall mode.
//
// Source: https://github.com/skishore/makemeahanzi (dictionary.txt),
// derived from Unihan and CJKlib, licensed under LGPL v3. See
// scripts/raw/mmh_dictionary.txt.
//
// Run with: node scripts/build-mnemonics.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'raw/mmh_dictionary.txt');
const OUT = join(__dirname, '../public/dict/decomposition.json');

const raw = readFileSync(SRC, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

/** @type {Record<string, { d?: string; t?: string; h?: string }>} */
const out = {};

let withHint = 0;
for (const line of lines) {
  const entry = JSON.parse(line);
  const record = {};
  if (entry.decomposition && entry.decomposition !== '？') record.d = entry.decomposition;
  if (entry.etymology?.hint) {
    record.h = entry.etymology.hint;
    record.t = entry.etymology.type;
    withHint++;
  }
  if (record.d || record.h) out[entry.character] = record;
}

writeFileSync(OUT, JSON.stringify(out));

console.log(`Parsed ${lines.length} characters, ${withHint} with a written etymology hint.`);
console.log(`Wrote ${OUT}`);
