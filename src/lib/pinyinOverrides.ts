import { customPinyin } from 'pinyin-pro';

// pinyin-pro (the library segment.ts uses for all pinyin generation) gets a
// handful of common words wrong — usually because the word uses a rarer
// reading of a heteronym (多音字) that its context model doesn't recognize.
// Each entry here was verified against standard dictionary readings by
// checking both the bare word and a natural sentence with
// `node -e "const {pinyin}=require('pinyin-pro'); console.log(pinyin('...'))"`
// before being added.
//
// Only unambiguous words belong here — i.e. the "wrong" reading isn't
// legitimately correct for a different, common meaning of the same word.
// For example 地道 ("authentic", dì dao) vs 地道 ("tunnel", dì dào), and
// 朝阳 ("morning sun", zhāo yáng) vs the Beijing district name (Cháoyáng),
// both depend on sentence meaning a word-level override can't know — so
// they're deliberately left alone rather than risk breaking the other
// meaning.
customPinyin({
  粘贴: 'zhān tiē', // "to paste/affix" — not nián (sticky/glutinous)
  数一数: 'shǔ yi shǔ', // "count [them]" — 数 as the verb "to count", not the noun "number" (shù)
  数数: 'shǔ shù', // "to count" — verb (shǔ) + noun (shù), not shuò
  和面: 'huó miàn', // "to knead dough" — 和 as "to mix with liquid", not hé "and/harmony"
  和泥: 'huó ní', // "to mix mud/mortar" — same huó reading as 和面
  盛饭: 'chéng fàn', // "to serve/ladle rice" — 盛 as "to hold/serve", not shèng "flourishing"
  湖泊: 'hú pō', // "lake" — 泊 as "body of water", not bó (as in 停泊/泊车 "to moor/park")
  流血: 'liú xiě', // "to bleed" — everyday colloquial reading, not the literary xuè (血液/血管)
  一场雨: 'yì cháng yǔ', // "a rain shower" — 场 as cháng for weather/illness, not chǎng (venues/events)
});
