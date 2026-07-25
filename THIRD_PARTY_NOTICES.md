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
