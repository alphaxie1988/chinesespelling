export type ExamplesData = Record<string, string[]>;

let examplesPromise: Promise<ExamplesData> | null = null;

// Word -> up to 2 example sentences (built from the Tatoeba project's
// Mandarin sentences, see scripts/build-examples.mjs), fetched once and
// reused, same lazy-load pattern as the CC-CEDICT dictionary and character
// decomposition data. Coverage is inherently partial — only words that
// happen to appear in a usable Tatoeba sentence have entries.
export function loadExamples(): Promise<ExamplesData> {
  if (!examplesPromise) {
    examplesPromise = fetch(`${import.meta.env.BASE_URL}dict/examples.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load example sentences (HTTP ${res.status})`);
        return res.json() as Promise<ExamplesData>;
      })
      .catch((err) => {
        examplesPromise = null;
        throw err;
      });
  }
  return examplesPromise;
}
