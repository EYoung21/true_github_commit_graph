import { Card } from './card';
import { Theme } from '../const/theme';

interface StatsData {
  username: string;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLines: number;
  totalCommits: number;
  filteredCommits: number;
  contributingDays: number;
  longestStreak: number;
  currentStreak: number;
  avgLinesPerDay: number;
  avgLinesPerCommit: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return Math.round(num).toString();
}

// Code icon (terminal/brackets)
const codeIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
</svg>`;

// Commit icon
const commitIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M11.93 8.5a4.002 4.002 0 01-7.86 0H.75a.75.75 0 010-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 010 1.5h-3.32zM8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
</svg>`;

// Flame icon (streak)
const flameIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M7.998 14.5c2.832 0 5-1.98 5-4.5 0-1.463-.68-2.19-1.879-3.383l-.036-.037c-1.013-1.008-2.3-2.29-2.834-4.434-.322.256-.63.579-.864.953-.432.696-.621 1.58-.046 2.73.473.947.67 2.284-.278 3.232-.61.61-1.545.84-2.403.633a2.79 2.79 0 01-1.436-.874A3.198 3.198 0 003 10c0 2.53 2.164 4.5 4.998 4.5zM9.533.753C9.496.34 9.16.009 8.77.146 7.035.75 4.34 3.187 5.997 6.5c.344.689.285 1.218.003 1.5-.419.419-1.796.167-2.31-.197-.23-.163-.552-.134-.72.098l-.04.054c-.36.486-.527 1.048-.527 1.545 0 3.07 2.527 5.5 5.597 5.5 3.07 0 5.5-2.424 5.5-5.5 0-1.93-.862-2.983-2.043-4.158l-.037-.037c-1.195-1.19-2.564-2.553-1.887-4.552z"/>
</svg>`;

// Plus icon
const plusIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z"/>
</svg>`;

// Minus icon  
const minusIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M2 7.75A.75.75 0 012.75 7h10a.75.75 0 010 1.5h-10A.75.75 0 012 7.75z"/>
</svg>`;

// Calendar icon
const calendarIcon = `
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
  <path d="M4.75 0a.75.75 0 01.75.75V2h5V.75a.75.75 0 011.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0113.25 16H2.75A1.75 1.75 0 011 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 014.75 0zm0 3.5h-.5a.25.25 0 00-.25.25V6h8V3.75a.25.25 0 00-.25-.25h-.5V4a.75.75 0 01-1.5 0v-.5H6V4a.75.75 0 01-1.5 0v-.5h-.25zm5.25 5v2.5H7.5v-2.5h2.5zm-4 0v2.5H3.5v-2.5H6zm0 4H3.5v1.25c0 .138.112.25.25.25H6v-1.5zm1.5 0v1.5h2.5v-1.5H7.5zm4 0v1.5h1.25a.25.25 0 00.25-.25V12.5h-1.5zm0-1.5h1.5v-2.5h-1.5v2.5zm0-4h1.5V3.75a.25.25 0 00-.25-.25h-1.25V3.5a.75.75 0 01-1.5 0v-.5H6v.5a.75.75 0 01-1.5 0v-.5h-.5a.25.25 0 00-.25.25V7h8V3.75a.25.25 0 00-.25-.25h-1.25V4a.75.75 0 01-1.5 0v-.5h-2.5V4a.75.75 0 01-1.5 0v-.5h-.5V7h8z"/>
</svg>`;

export function createStatsCard(stats: StatsData, theme: Theme): string {
  const cardWidth = 400;
  const cardHeight = 200;
  
  const card = new Card(`${stats.username}'s Code Stats`, cardWidth, cardHeight, theme, 20, 28);
  const svg = card.getSVG();
  const rootSvg = card.getRootSVG();

  // Add subtitle
  rootSvg
    .append('text')
    .attr('class', 'subtitle')
    .attr('x', cardWidth - 20)
    .attr('y', 28)
    .attr('text-anchor', 'end')
    .attr('fill', theme.text)
    .attr('font-size', '10px')
    .attr('opacity', 0.5)
    .text('Lines of Code Based');

  const statsItems = [
    { icon: codeIcon, label: 'Total Lines Changed', value: formatNumber(stats.totalLines), color: theme.accent },
    { icon: plusIcon, label: 'Lines Added', value: `+${formatNumber(stats.totalLinesAdded)}`, color: '#3fb950' },
    { icon: minusIcon, label: 'Lines Deleted', value: `-${formatNumber(stats.totalLinesDeleted)}`, color: '#f85149' },
    { icon: commitIcon, label: 'Total Commits', value: formatNumber(stats.totalCommits), color: theme.title },
    { icon: calendarIcon, label: 'Contributing Days', value: stats.contributingDays.toString(), color: theme.text },
    { icon: flameIcon, label: 'Avg Lines/Commit', value: formatNumber(stats.avgLinesPerCommit), color: '#f0883e' }
  ];

  const itemHeight = 22;
  const startY = 20;
  const col1X = 20;
  const col2X = cardWidth / 2 + 10;

  statsItems.forEach((item, idx) => {
    const x = idx % 2 === 0 ? col1X : col2X;
    const y = startY + Math.floor(idx / 2) * itemHeight;

    // Icon
    svg
      .append('g')
      .attr('transform', `translate(${x}, ${y - 12})`)
      .attr('fill', item.color)
      .html(item.icon);

    // Label
    svg
      .append('text')
      .attr('x', x + 22)
      .attr('y', y)
      .attr('fill', theme.text)
      .attr('font-size', '11px')
      .attr('opacity', 0.8)
      .text(item.label);

    // Value
    svg
      .append('text')
      .attr('x', idx % 2 === 0 ? col2X - 20 : cardWidth - 20)
      .attr('y', y)
      .attr('text-anchor', 'end')
      .attr('fill', item.color)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text(item.value);
  });

  // Filtered commits note (if any)
  if (stats.filteredCommits > 0) {
    svg
      .append('text')
      .attr('x', cardWidth / 2)
      .attr('y', cardHeight - 50)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.text)
      .attr('font-size', '9px')
      .attr('opacity', 0.4)
      .text(`${stats.filteredCommits} commits filtered (data files excluded)`);
  }

  return card.toString();
}

export function calculateStats(
  dailyContributions: Map<string, { totalLines: number; commits: number; linesAdded: number; linesDeleted: number }>,
  totalLinesAdded: number,
  totalLinesDeleted: number,
  totalCommits: number,
  filteredCommits: number,
  username: string
): StatsData {
  // Calculate contributing days
  const contributingDays = Array.from(dailyContributions.values()).filter(d => d.totalLines > 0).length;

  // Calculate streaks
  const dates = Array.from(dailyContributions.keys()).sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < dates.length; i++) {
    const contribution = dailyContributions.get(dates[i]);
    if (contribution && contribution.totalLines > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Current streak (from today backwards)
  const today = new Date().toISOString().split('T')[0];
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] > today) continue;
    const contribution = dailyContributions.get(dates[i]);
    if (contribution && contribution.totalLines > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  const avgLinesPerDay = contributingDays > 0 ? (totalLinesAdded + totalLinesDeleted) / contributingDays : 0;
  const avgLinesPerCommit = totalCommits > 0 ? (totalLinesAdded + totalLinesDeleted) / totalCommits : 0;

  return {
    username,
    totalLinesAdded,
    totalLinesDeleted,
    totalLines: totalLinesAdded + totalLinesDeleted,
    totalCommits,
    filteredCommits,
    contributingDays,
    longestStreak,
    currentStreak,
    avgLinesPerDay,
    avgLinesPerCommit
  };
}

