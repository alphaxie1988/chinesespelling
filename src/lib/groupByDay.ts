export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

// Local calendar day (not UTC) so "today"/"yesterday" match what the user
// actually sees on their clock, not whatever day it happens to be in UTC.
function dayKeyFromTimestamp(timestamp: number): string {
  // Saved items should always have a valid createdAt (see storage.ts), but
  // fall back to "today" for anything malformed/missing rather than
  // crashing the grouping or silently dropping the item.
  const ms = Number.isFinite(timestamp) ? timestamp : Date.now();
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();

  if (key === dayKeyFromTimestamp(now.getTime())) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKeyFromTimestamp(yesterday.getTime())) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: y === now.getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Groups items by the local calendar day they were created on, newest day
 * first, preserving each item's relative order within its day. Used to
 * split saved phrases into "Today" / "Yesterday" / dated accordions in My
 * List, Practise, and Test.
 */
export function groupByDay<T extends { createdAt: number }>(items: T[]): DayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKeyFromTimestamp(item.createdAt);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, groupItems]) => ({ key, label: formatDayLabel(key), items: groupItems }));
}
