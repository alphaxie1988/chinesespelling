# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chinese Spelling Buddy — a primary-school Chinese learning PWA. Paste a Chinese phrase or sentence and get pinyin, tap-to-reveal English meanings, text-to-speech, a handwriting-practice mode, a listen-and-recall test mode, and camera-based OCR for scanning a worksheet into text. Fully offline: no backend, no API keys, no per-request cost. All data (dictionary, stroke data, OCR models) is bundled as static assets and fetched lazily.

Deployed as a static site to GitHub Pages at a non-root subpath (`https://<user>.github.io/chinesespelling/`), which is why `vite.config.ts` sets `base: '/chinesespelling/'` and why runtime code that builds asset URLs uses `import.meta.env.BASE_URL` rather than absolute `/` paths.

## Commands

- `npm run dev` — Vite dev server. **OCR-related features (CameraScan) do not work correctly under `vite dev`** — dynamic imports of files under `public/` get intercepted by Vite's dev-time module transform pipeline. Always test OCR against a production build (`npm run build` + a static file server) instead.
- `npm run build` — `tsc -b && vite build`. Type-checking happens via the `tsc -b` step (project references: `tsconfig.app.json` for app code, `tsconfig.node.json` for Vite config). Run `npx tsc -b --noEmit` on its own for a fast type-check without a full build.
- `npm run lint` — `oxlint`.
- `npm run preview` — serve the production build locally.
- There is no automated test suite / no `npm test` script. Verification during development is done by building, serving `dist/` with a static server, and driving it with Playwright (see "Testing OCR and PWA behavior" below).

### Rebuilding generated data assets

Three scripts turn raw third-party data (checked into `scripts/raw/`) into the JSON assets the app fetches at runtime. Re-run them after editing the raw source files or the parsing logic — they are not run automatically by `npm run build`.

- `node scripts/build-dict.mjs` — parses `scripts/raw/cedict_ts.u8` (CC-CEDICT) into `public/dict/cedict.json`. Filters out classifier annotations and cross-reference-only glosses (`variant of X`, `old variant of X`, `see also X`, or any gloss that just repeats the headword itself) since these aren't useful English meanings for a kid. A word can still end up with an empty definitions array after filtering (e.g. an obscure character whose only CEDICT entries were cross-references) — it's kept in the dictionary anyway (as `[]`, which is truthy) so forward-maximum-matching segmentation still recognizes it as a word; the UI falls back to showing pinyin for those.
- `node scripts/build-mnemonics.mjs` — parses `scripts/raw/mmh_dictionary.txt` (Make Me a Hanzi) into `public/dict/decomposition.json`, used for "creative way to remember" character mnemonics in Test mode.
- `node scripts/build-examples.mjs` — parses `scripts/raw/tatoeba_cmn_sentences.tsv` (Tatoeba's Mandarin sentence export) into `public/dict/examples.json`, a word → up to 2 example sentences index used for "Sample sentences" in the word detail panel. Must run after `build-dict.mjs` (reads `public/dict/cedict.json` to know which words to index by, using the same forward-maximum-matching approach as `segmentAndAnnotate`). Tatoeba's `cmn` export mixes Simplified and Traditional Chinese; sentences containing any Traditional-only character (derived from CC-CEDICT's own traditional/simplified word pairs) are excluded, since this app's dictionary/segmentation is Simplified-only. Coverage is inherently partial — only words that appear in a usable Tatoeba sentence get an entry. The raw `.tsv` is a plain-text decompression of the upstream `cmn_sentences.tsv.bz2` (Node has no built-in bzip2 support, so this script expects the already-decompressed file, not the archive).

### Patched dependencies

`patches/*.patch` are applied automatically via the `postinstall` npm script (`patch-package`), so they survive a fresh `npm install`/`npm ci` (including in CI). When adding a new patch: edit the file under `node_modules/` directly, then run `npx patch-package <package-name>` to (re)generate the patch file. To verify a patch still applies cleanly, reinstall the package fresh (`rm -rf node_modules/<pkg> && npm install <pkg>@<version> --no-save`) and re-run `npx patch-package` — it should report success and the file should end up byte-identical to your edit.

Current patches and why:
- `js-clipper` — a decorative comment in the source has Latin-1-encoded superscript characters that break Vite/Rolldown's strict UTF-8 parsing; replaced with plain ASCII.
- `@gutenye/ocr-common` — `splitIntoLineImages`'s per-contour processing loop can throw on a degenerate detected region (a very small/thin region — a pinyin annotation, a stray correction mark, text sitting flush against a crop's border) which used to abort the entire scan; wrapped the loop body in try/catch so one bad region is skipped instead.

### Testing OCR and PWA behavior

Because GitHub Pages serves from a subpath and has no custom headers, and because `vite dev` doesn't handle this app's dynamic imports from `public/` correctly, verify OCR/PWA changes against a production build served in a way that mimics GitHub Pages: build with `npm run build`, then serve `dist/` through a directory structure that reproduces the `/chinesespelling/` subpath (e.g. a symlink `some-root/chinesespelling -> dist`, served with any static file server from `some-root`). Note the headless test environment used in this project's history has no CJK fonts installed, so screenshots/synthetic test images render Chinese text as empty boxes — real OCR recognition can't be validated this way, only that the pipeline runs without crashing.

## Architecture

### Data flow: dictionary + segmentation + pinyin

`src/lib/segment.ts`'s `segmentAndAnnotate(text, dict)` is the core of the Reader/SavedList/Test/RecallMode views. It does two things in one pass:
1. Forward-maximum-matching word segmentation against the dictionary's own key set (checks progressively shorter substrings, up to `MAX_WORD_LEN`, until one matches a real dictionary entry).
2. Pinyin generation for the **whole input string at once** via `pinyin-pro`, then re-grouped to match each segment — this is deliberate, so polyphonic characters (多音字) resolve to the reading that fits the surrounding sentence rather than a generic default.

`resolveDisplayMeanings(meanings, pinyin)` is the fallback used everywhere a word's meaning is displayed: if the dictionary has no useful gloss (empty or missing), it shows the segment's already-resolved (context-correct) pinyin instead of a dead end.

The dictionary (`public/dict/cedict.json`) is fetched once at runtime (`src/lib/dictionary.ts`), not bundled into JS — it's a build artifact from `build-dict.mjs`, cached indefinitely via the service worker's `CacheFirst` runtime caching (see `vite.config.ts`).

### View routing and code-splitting

`App.tsx` is a hand-rolled router keyed on a `ViewName` string (`'reader' | 'saved' | 'test' | 'recall' | 'progress'`) — no router library. **Naming note that trips people up**: the "Practise" nav tab (handwriting quiz) uses view name `'test'` and component `TestMode.tsx`; the "Test" nav tab (listen-and-recall quiz) uses view name `'recall'` and component `RecallMode.tsx`. The names don't match the UI labels.

`TestMode`, `RecallMode`, and `ProgressView` are `React.lazy`-loaded (their JS chunks, plus everything `TestMode` pulls in — `hanzi-writer` — and everything `RecallMode`/OCR pull in, are only fetched once a user actually navigates there). The lazy imports are wrapped in `withChunkReload` (in `App.tsx`): a tab left open across a new deploy still has an `index.html` referencing hashed chunk filenames that no longer exist once a newer build replaces them, so the first dynamic `import()` after a deploy 404s — this wrapper catches that and does a one-time `window.location.reload()` (guarded by a `sessionStorage` flag against a reload loop) instead of leaving the tab broken.

`ErrorBoundary` wraps `<main>`'s contents, keyed by `view`, so an uncaught render/commit-phase error on one tab doesn't take down the whole app and offers a way back in.

### Speech (Web Speech API)

`src/lib/speech.ts` wraps `window.speechSynthesis`. `src/lib/useSpeechPlayback.ts` is a hook built on top of it providing play/pause/continue, used by both Reader's "Read aloud" button and Test mode's audio circle. It exists because `speechSynthesis.resume()` is unreliable across browsers/OSes once paused (a long-standing platform bug — it looks like it should work but silently never resumes): pausing actually cancels the utterance, and continuing re-speaks just the remaining text. Resume position comes from the `onboundary` event's `charIndex` when the voice fires it, falling back to a rough elapsed-time estimate (deliberately biased short) when it doesn't — not every voice fires boundary events for Chinese.

### Handwriting practice (TestMode / "Practise" tab)

Uses `hanzi-writer` with stroke data fetched per-character from `public/hanzi-data/` (built from the `hanzi-writer-data` npm package, ~9575 characters) via a custom `charDataLoader` (`src/lib/hanziData.ts`). `HanziWriter.create()` is given an `onLoadCharDataError` handler so a character missing from that dataset shows a message and auto-advances instead of leaving the quiz stuck on a blank canvas forever.

### OCR ("Scan a list" in Reader)

`CameraScan.tsx` → crop (`react-image-crop`) → `src/lib/ocr.ts` → review/edit extracted lines → confirms into Reader's text box. The OCR engine (`@gutenye/ocr-browser`, PP-OCRv4 via `onnxruntime-web`) and its models are dynamically imported only when a scan actually runs, not merely because Reader rendered the button — this is a large, rarely-used feature and shouldn't bloat the initial bundle. `handleConfirmCrop`/`handleUseFullPhoto` lock the UI (transition to the "processing" step) synchronously before any `await`, specifically to prevent a second tap from re-entering the handler while the first is still in flight and launching a second overlapping scan against the same (singleton) OCR engine instance. A crop is padded by a small margin before scanning (`padCrop`) since a crop drawn flush against the text can make the OCR engine's contour-processing step throw (see the `@gutenye/ocr-common` patch above).

### Storage and progress

`src/lib/storage.ts` is a thin localStorage wrapper for saved phrases, handwriting/recall attempt history, and settings (recall playback speed). `src/lib/progress.ts` derives gamification stats (XP, streaks, badges) shown in `ProgressView` from that attempt history — there's no separate persisted "progress" record, it's computed from the raw attempt log each time.
