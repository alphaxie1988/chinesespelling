// Shared by Test mode (RecallMode) and Practise mode (TestMode) summary
// screens: same three-tier sound based on a first-try score (0-1) — a word
// that needed a retry, or a character written with a mistake, never counts
// as correct here regardless of whether it was eventually gotten right.
export function pickSummarySoundFile(score: number): string {
  if (score >= 1) return 'perfect-score.mp3';
  if (score >= 0.5) return 'good-effort.mp3';
  return 'keep-trying.mp3';
}

export function playSummarySound(file: string): void {
  new Audio(`${import.meta.env.BASE_URL}sounds/${file}`).play().catch(() => {});
}
