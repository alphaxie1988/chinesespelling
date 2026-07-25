# Third-party data

This app bundles the following open datasets as static assets so it can work fully offline.

## CC-CEDICT (`public/dict/cedict.json`, built by `scripts/build-dict.mjs`)

- Source: https://cc-cedict.org/ (published by MDBG), raw data from `scripts/raw/cedict_ts.u8`
- License: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## Make Me a Hanzi — character decomposition & etymology (`public/dict/decomposition.json`, built by `scripts/build-mnemonics.mjs`)

- Source: https://github.com/skishore/makemeahanzi (`dictionary.txt`), derived from Unihan and CJKlib, raw data from `scripts/raw/mmh_dictionary.txt`
- License: GNU Lesser General Public License v3 ([full text](https://www.gnu.org/licenses/lgpl-3.0.txt))

## Hanzi Writer character stroke data (`public/hanzi-data/`)

- Source: [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) npm package, itself derived from the Make Me a Hanzi project's stroke graphics (based on Arphic PL KaitiM GB / UKai fonts)
- License: Arphic Public License — full text in [`licenses/ARPHIC-PUBLIC-LICENSE.txt`](licenses/ARPHIC-PUBLIC-LICENSE.txt)

## PP-OCRv4 text detection/recognition models (`public/ocr/`) — camera-scan feature

- Source: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), accessed via the [@gutenye/ocr-browser](https://github.com/gutenye/ocr) npm package (MIT-licensed JS/ONNX Runtime wrapper) and its bundled `@gutenye/ocr-models`
- License: [Apache License 2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE)
- Runs fully offline in the browser via [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (`public/ort/`), also under Apache 2.0 — no server, no API key, no cost.

## js-clipper patch (`patches/js-clipper+1.0.1.patch`)

A transitive dependency of the OCR pipeline ships a source file with a few
stray Latin-1-encoded characters in a decorative code comment, which fails
strict UTF-8 parsing in some build tools. The patch (applied automatically
via `patch-package` on install) only touches that comment text — no logic
is changed.
