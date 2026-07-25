import type { Dictionary } from '../types';

// The dictionary JSON is ~7MB (built from CC-CEDICT, see scripts/build-dict.mjs).
// It's served as a static asset and fetched once at runtime rather than bundled
// into the JS, so it can be cached offline by the service worker independently
// of app code updates.
let dictPromise: Promise<Dictionary> | null = null;

export function loadDictionary(): Promise<Dictionary> {
  if (!dictPromise) {
    dictPromise = fetch(`${import.meta.env.BASE_URL}dict/cedict.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load dictionary (HTTP ${res.status})`);
        }
        return res.json() as Promise<Dictionary>;
      })
      .catch((err) => {
        // Allow a later retry (e.g. after the user reconnects) instead of
        // permanently caching a rejected promise.
        dictPromise = null;
        throw err;
      });
  }
  return dictPromise;
}

export function lookup(dict: Dictionary, word: string): string[] | null {
  return dict[word] ?? null;
}
