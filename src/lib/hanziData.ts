import type { CharDataLoaderFn, CharacterJson } from 'hanzi-writer';

// HanziWriter fetches per-character stroke data on demand. By default it
// pulls from a public CDN; instead we serve the same dataset (built from the
// Make Me a Hanzi project, via the hanzi-writer-data npm package — see
// public/hanzi-data/) from our own static assets so stroke-order practice
// works fully offline and doesn't depend on a third-party CDN staying up.
export const hanziCharDataLoader: CharDataLoaderFn = (char, onLoad, onError) => {
  fetch(`${import.meta.env.BASE_URL}hanzi-data/${encodeURIComponent(char)}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`No stroke data for "${char}" (HTTP ${res.status})`);
      return res.json() as Promise<CharacterJson>;
    })
    .then(onLoad)
    .catch(onError);
};
