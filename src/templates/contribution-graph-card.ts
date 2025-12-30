import { Card } from './card';
import { Theme } from '../const/theme';
import { DailyContribution } from '../github-api/fetch-contributions';

interface WeekData {
  weekIndex: number;
  days: (DailyContribution | null)[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function getContributionLevel(lines: number, maxLines: number): number {
  if (lines === 0) return 0;
  const percentage = lines / maxLines;
  if (percentage <= 0.25) return 1;
  if (percentage <= 0.50) return 2;
  if (percentage <= 0.75) return 3;
  return 4;
}

export function createContributionGraphCard(
  username: string,
  dailyContributions: Map<string, DailyContribution>,
  totalLines: number,
  totalCommits: number,
  yearStart: string,
  yearEnd: string,
  theme: Theme
): string {
  const cardWidth = 850;
  const cardHeight = 220;
  
  const card = new Card('True GitHub Commit Graph', cardWidth, cardHeight, theme, 20, 28);
  const svg = card.getSVG();
  const rootSvg = card.getRootSVG();

  // Add subtitle with username
  rootSvg
    .append('text')
    .attr('class', 'subtitle')
    .attr('x', 210)
    .attr('y', 28)
    .attr('fill', theme.text)
    .attr('font-size', '12px')
    .attr('opacity', 0.7)
    .text(`@${username} • Lines of Code`);

  // Calculate grid dimensions
  const cellSize = 11;
  const cellGap = 3;
  const gridStartX = 45;
  const gridStartY = 25;
  
  // Prepare data: Create 53 weeks x 7 days grid
  const startDate = new Date(yearStart);
  const endDate = new Date(yearEnd);
  
  // Adjust start to beginning of week (Sunday)
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());
  
  // Build weeks array
  const weeks: WeekData[] = [];
  let currentDate = new Date(adjustedStart);
  let weekIndex = 0;
  
  while (currentDate <= endDate || weeks.length < 53) {
    const week: (DailyContribution | null)[] = [];
    
    for (let day = 0; day < 7; day++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (currentDate >= startDate && currentDate <= endDate) {
        const contribution = dailyContributions.get(dateStr);
        week.push(contribution || { date: dateStr, linesAdded: 0, linesDeleted: 0, totalLines: 0, commits: 0 });
      } else {
        week.push(null);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    weeks.push({ weekIndex, days: week });
    weekIndex++;
    
    if (weeks.length >= 53) break;
  }
  
  // Find max lines for color scaling
  let maxLines = 0;
  for (const data of dailyContributions.values()) {
    if (data.totalLines > maxLines) {
      maxLines = data.totalLines;
    }
  }
  // Ensure we have a reasonable max for color scaling
  maxLines = Math.max(maxLines, 100);

  // Draw month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;
  
  weeks.forEach((week, weekIdx) => {
    const firstValidDay = week.days.find(d => d !== null);
    if (firstValidDay) {
      const date = new Date(firstValidDay.date);
      const month = date.getMonth();
      
      if (month !== lastMonth) {
        svg
          .append('text')
          .attr('class', 'month-label')
          .attr('x', gridStartX + weekIdx * (cellSize + cellGap))
          .attr('y', gridStartY - 8)
          .text(months[month]);
        lastMonth = month;
      }
    }
  });

  // Draw day labels
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  dayLabels.forEach((label, idx) => {
    if (label) {
      svg
        .append('text')
        .attr('class', 'day-label')
        .attr('x', gridStartX - 25)
        .attr('y', gridStartY + idx * (cellSize + cellGap) + cellSize - 2)
        .text(label);
    }
  });

  // Draw contribution cells
  weeks.forEach((week, weekIdx) => {
    week.days.forEach((day, dayIdx) => {
      if (day === null) return;
      
      const level = getContributionLevel(day.totalLines, maxLines);
      const x = gridStartX + weekIdx * (cellSize + cellGap);
      const y = gridStartY + dayIdx * (cellSize + cellGap);
      
      const cell = svg
        .append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', theme.levels[level]);
      
      // Add tooltip data as attributes
      if (day.totalLines > 0) {
        cell.attr('data-date', day.date);
        cell.attr('data-lines', day.totalLines);
        cell.attr('data-commits', day.commits);
      }
    });
  });

  // Stats section (right side)
  const statsX = cardWidth - 130;
  const statsY = 35;
  
  // Total lines stat
  svg
    .append('text')
    .attr('class', 'stat-value')
    .attr('x', statsX)
    .attr('y', statsY)
    .attr('fill', theme.accent)
    .attr('font-size', '20px')
    .text(formatNumber(totalLines));
  
  svg
    .append('text')
    .attr('class', 'stat-label')
    .attr('x', statsX)
    .attr('y', statsY + 18)
    .attr('fill', theme.text)
    .attr('font-size', '10px')
    .text('lines changed');

  // Commits stat
  svg
    .append('text')
    .attr('class', 'stat-value')
    .attr('x', statsX)
    .attr('y', statsY + 50)
    .attr('fill', theme.title)
    .attr('font-size', '16px')
    .text(formatNumber(totalCommits));
  
  svg
    .append('text')
    .attr('class', 'stat-label')
    .attr('x', statsX)
    .attr('y', statsY + 66)
    .attr('fill', theme.text)
    .attr('font-size', '10px')
    .text('commits');

  // Legend
  const legendY = cardHeight - 35;
  const legendX = gridStartX;
  
  svg
    .append('text')
    .attr('x', legendX)
    .attr('y', legendY + 10)
    .attr('fill', theme.text)
    .attr('font-size', '9px')
    .attr('opacity', 0.6)
    .text('Less');

  theme.levels.forEach((color, idx) => {
    svg
      .append('rect')
      .attr('x', legendX + 30 + idx * (cellSize + 2))
      .attr('y', legendY)
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', color);
  });

  svg
    .append('text')
    .attr('x', legendX + 30 + 5 * (cellSize + 2) + 5)
    .attr('y', legendY + 10)
    .attr('fill', theme.text)
    .attr('font-size', '9px')
    .attr('opacity', 0.6)
    .text('More');

  // Year range
  svg
    .append('text')
    .attr('x', cardWidth - 140)
    .attr('y', legendY + 10)
    .attr('fill', theme.text)
    .attr('font-size', '9px')
    .attr('opacity', 0.5)
    .text(`${yearStart} → ${yearEnd}`);

  return card.toString();
}

