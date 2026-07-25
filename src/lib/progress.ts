import { getRecallAttempts, getTestAttempts } from './storage';
import type { RecallAttemptRecord, TestAttemptRecord } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Streak {
  current: number;
  longest: number;
}

/** Consecutive-calendar-day streak (local time) across a set of activity timestamps. */
export function computeStreak(timestamps: number[]): Streak {
  if (timestamps.length === 0) return { current: 0, longest: 0 };

  const daySet = new Set(timestamps.map(startOfLocalDay));
  const days = Array.from(daySet).sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] - days[i - 1] === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayStart = startOfLocalDay(Date.now());
  const yesterdayStart = todayStart - DAY_MS;

  let current = 0;
  if (daySet.has(todayStart) || daySet.has(yesterdayStart)) {
    let cursor = daySet.has(todayStart) ? todayStart : yesterdayStart;
    while (daySet.has(cursor)) {
      current += 1;
      cursor -= DAY_MS;
    }
  }

  return { current, longest };
}

function computeXP(recallAttempts: RecallAttemptRecord[], testAttempts: TestAttemptRecord[]): number {
  let xp = 0;
  for (const a of recallAttempts) xp += a.know ? 10 : 2;
  for (const a of testAttempts) xp += a.mistakes === 0 ? 15 : 5;
  return xp;
}

const LEVELS = [
  { title: 'Sprout', minXP: 0 },
  { title: 'New Learner', minXP: 50 },
  { title: 'Word Explorer', minXP: 150 },
  { title: 'Character Master', minXP: 300 },
  { title: 'Language Scholar', minXP: 500 },
  { title: 'Fluency Champion', minXP: 800 },
  { title: 'Grand Scholar', minXP: 1200 },
];

export interface Level {
  levelNumber: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  isMaxLevel: boolean;
}

function computeLevel(xp: number): Level {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP) index = i;
  }
  const current = LEVELS[index];
  const next = LEVELS[index + 1];
  return {
    levelNumber: index + 1,
    title: current.title,
    xpIntoLevel: xp - current.minXP,
    xpForNextLevel: next ? next.minXP - current.minXP : null,
    isMaxLevel: !next,
  };
}

function latestRecallKnownByCard(attempts: RecallAttemptRecord[]): Map<string, boolean> {
  const latestAt = new Map<string, number>();
  const known = new Map<string, boolean>();
  for (const a of attempts) {
    const prevAt = latestAt.get(a.cardId);
    if (prevAt === undefined || a.attemptedAt > prevAt) {
      latestAt.set(a.cardId, a.attemptedAt);
      known.set(a.cardId, a.know);
    }
  }
  return known;
}

export type BadgeKey =
  | 'streak-3'
  | 'streak-7'
  | 'first-word'
  | 'words-10'
  | 'words-50'
  | 'first-perfect-char'
  | 'perfect-chars-20'
  | 'xp-100'
  | 'xp-500';

export interface Badge {
  key: BadgeKey;
  label: string;
  achieved: boolean;
}

function computeBadges(input: {
  longestStreak: number;
  wordsKnown: number;
  perfectCharacters: number;
  xp: number;
}): Badge[] {
  return [
    { key: 'streak-3', label: '3-Day Streak', achieved: input.longestStreak >= 3 },
    { key: 'streak-7', label: '7-Day Streak', achieved: input.longestStreak >= 7 },
    { key: 'first-word', label: 'First Word Learned', achieved: input.wordsKnown >= 1 },
    { key: 'words-10', label: '10 Words Known', achieved: input.wordsKnown >= 10 },
    { key: 'words-50', label: '50 Words Known', achieved: input.wordsKnown >= 50 },
    { key: 'first-perfect-char', label: 'First Perfect Character', achieved: input.perfectCharacters >= 1 },
    { key: 'perfect-chars-20', label: '20 Perfect Characters', achieved: input.perfectCharacters >= 20 },
    { key: 'xp-100', label: '100 XP Earned', achieved: input.xp >= 100 },
    { key: 'xp-500', label: '500 XP Earned', achieved: input.xp >= 500 },
  ];
}

export interface ProgressStats {
  xp: number;
  level: Level;
  streak: Streak;
  wordsKnown: number;
  wordsSeen: number;
  charactersPracticed: number;
  perfectCharacters: number;
  badges: Badge[];
}

export function getProgressStats(): ProgressStats {
  const recallAttempts = getRecallAttempts();
  const testAttempts = getTestAttempts();

  const xp = computeXP(recallAttempts, testAttempts);
  const level = computeLevel(xp);

  const activityTimestamps = [
    ...recallAttempts.map((a) => a.attemptedAt),
    ...testAttempts.map((a) => a.attemptedAt),
  ];
  const streak = computeStreak(activityTimestamps);

  const latestRecall = latestRecallKnownByCard(recallAttempts);
  const wordsSeen = latestRecall.size;
  const wordsKnown = Array.from(latestRecall.values()).filter(Boolean).length;

  const practicedChars = new Set(testAttempts.map((a) => a.char));
  const perfectChars = new Set(testAttempts.filter((a) => a.mistakes === 0).map((a) => a.char));

  const badges = computeBadges({
    longestStreak: streak.longest,
    wordsKnown,
    perfectCharacters: perfectChars.size,
    xp,
  });

  return {
    xp,
    level,
    streak,
    wordsKnown,
    wordsSeen,
    charactersPracticed: practicedChars.size,
    perfectCharacters: perfectChars.size,
    badges,
  };
}
