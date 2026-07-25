import { useState } from 'react';
import { getProgressStats } from '../lib/progress';

export function ProgressView() {
  const [stats] = useState(() => getProgressStats());
  const hasActivity = stats.wordsSeen > 0 || stats.charactersPracticed > 0;

  return (
    <div className="progress-view">
      <div className="level-card">
        <div className="level-title">{stats.level.title}</div>
        <div className="level-sub">Level {stats.level.levelNumber}</div>
        {!stats.level.isMaxLevel && (
          <div className="xp-bar">
            <div
              className="xp-bar-fill"
              style={{ width: `${Math.min(100, (stats.level.xpIntoLevel / stats.level.xpForNextLevel!) * 100)}%` }}
            />
          </div>
        )}
        <div className="xp-label">
          {stats.level.isMaxLevel
            ? `${stats.xp} XP — max level reached!`
            : `${stats.level.xpIntoLevel} / ${stats.level.xpForNextLevel} XP to next level`}
        </div>
      </div>

      <div className="streak-card">
        <div className="streak-flame" aria-hidden="true">
          🔥
        </div>
        <div>
          <div className="streak-days">
            {stats.streak.current} day{stats.streak.current === 1 ? '' : 's'} streak
          </div>
          <div className="streak-sub">
            {stats.streak.current === 0
              ? 'Practice today to start a streak!'
              : `Longest streak: ${stats.streak.longest} day${stats.streak.longest === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-value">{stats.wordsKnown}</div>
          <div className="stat-label">Words &amp; phrases known</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{stats.charactersPracticed}</div>
          <div className="stat-label">Characters practiced</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{stats.perfectCharacters}</div>
          <div className="stat-label">Perfect characters</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{stats.xp}</div>
          <div className="stat-label">Total XP</div>
        </div>
      </div>

      <h2>Badges</h2>
      <div className="badges-grid">
        {stats.badges.map((b) => (
          <div key={b.label} className={`badge-tile ${b.achieved ? 'badge-achieved' : 'badge-locked'}`}>
            <div className="badge-icon">{b.achieved ? b.icon : '🔒'}</div>
            <div className="badge-label">{b.label}</div>
          </div>
        ))}
      </div>

      {!hasActivity && (
        <p className="empty-state">
          No activity yet — try the <strong>Recall</strong> or <strong>Write</strong> tabs to start earning XP!
        </p>
      )}
    </div>
  );
}
