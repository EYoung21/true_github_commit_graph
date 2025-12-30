import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

// ============ THEME ============
interface Theme {
  name: string;
  title: string;
  text: string;
  background: string;
  stroke: string;
  strokeOpacity: number;
  levels: string[];
  accent: string;
}

const themes: Record<string, Theme> = {
  github_dark: {
    name: 'github_dark',
    title: '#58a6ff',
    text: '#c9d1d9',
    background: '#0d1117',
    stroke: '#30363d',
    strokeOpacity: 1,
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    accent: '#58a6ff'
  },
  github: {
    name: 'github',
    title: '#0366d6',
    text: '#24292e',
    background: '#ffffff',
    stroke: '#e1e4e8',
    strokeOpacity: 1,
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    accent: '#0366d6'
  },
  dracula: {
    name: 'dracula',
    title: '#ff79c6',
    text: '#f8f8f2',
    background: '#282a36',
    stroke: '#44475a',
    strokeOpacity: 1,
    levels: ['#44475a', '#6272a4', '#8be9fd', '#50fa7b', '#ff79c6'],
    accent: '#bd93f9'
  }
};

function getTheme(name: string): Theme {
  return themes[name] || themes.github_dark;
}

// ============ FILTER CONFIG ============
const excludeExtensions = ['json', 'csv', 'lock', 'svg', 'png', 'jpg', 'min.js', 'min.css'];
const excludePaths = ['node_modules/', 'vendor/', 'dist/', 'build/'];
const maxLinesPerFile = 2000;

function shouldFilterFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const path of excludePaths) {
    if (lower.includes(path)) return true;
  }
  for (const ext of excludeExtensions) {
    if (lower.endsWith(`.${ext}`)) return true;
  }
  return false;
}

// ============ GITHUB API ============
interface DailyContribution {
  date: string;
  linesAdded: number;
  linesDeleted: number;
  totalLines: number;
  commits: number;
}

async function fetchContributions(username: string, token: string) {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setDate(yearAgo.getDate() - 365);

  // Get repos
  const reposQuery = `
    query GetRepos($login: String!) {
      user(login: $login) {
        repositories(first: 25, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes {
            name
            owner { login }
            defaultBranchRef { name }
          }
        }
      }
    }
  `;

  const reposRes = await axios.post('https://api.github.com/graphql', 
    { query: reposQuery, variables: { login: username } },
    { headers: { Authorization: `bearer ${token}` } }
  );

  if (reposRes.data.errors) {
    throw new Error(reposRes.data.errors[0].message);
  }

  const repos = reposRes.data.data.user.repositories.nodes.filter((r: any) => r.defaultBranchRef);
  const dailyContributions = new Map<string, DailyContribution>();
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  let totalCommits = 0;

  const since = yearAgo.toISOString();
  const until = now.toISOString();

  // Process repos (limit for Vercel timeout)
  for (const repo of repos.slice(0, 15)) {
    try {
      const commitsRes = await axios.get(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&since=${since}&until=${until}&per_page=30`,
        { headers: { Authorization: `token ${token}` } }
      );

      for (const commit of commitsRes.data.slice(0, 20)) {
        try {
          const detailRes = await axios.get(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits/${commit.sha}`,
            { headers: { Authorization: `token ${token}` } }
          );

          const detail = detailRes.data;
          const date = detail.commit.author.date.split('T')[0];
          let additions = 0;
          let deletions = 0;

          if (detail.files) {
            for (const file of detail.files) {
              if (shouldFilterFile(file.filename)) continue;
              if (file.additions > maxLinesPerFile) continue;
              additions += file.additions || 0;
              deletions += file.deletions || 0;
            }
          }

          if (!dailyContributions.has(date)) {
            dailyContributions.set(date, { date, linesAdded: 0, linesDeleted: 0, totalLines: 0, commits: 0 });
          }

          const day = dailyContributions.get(date)!;
          day.linesAdded += additions;
          day.linesDeleted += deletions;
          day.totalLines += additions + deletions;
          day.commits++;
          totalLinesAdded += additions;
          totalLinesDeleted += deletions;
          totalCommits++;
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return {
    dailyContributions,
    totalLines: totalLinesAdded + totalLinesDeleted,
    totalCommits,
    yearStart: yearAgo.toISOString().split('T')[0],
    yearEnd: now.toISOString().split('T')[0]
  };
}

// ============ SVG GENERATION ============
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getContributionLevel(lines: number, maxLines: number): number {
  if (lines === 0) return 0;
  const pct = lines / maxLines;
  if (pct <= 0.25) return 1;
  if (pct <= 0.50) return 2;
  if (pct <= 0.75) return 3;
  return 4;
}

function createSVG(
  username: string,
  dailyContributions: Map<string, DailyContribution>,
  totalLines: number,
  totalCommits: number,
  yearStart: string,
  yearEnd: string,
  theme: Theme
): string {
  const width = 850;
  const height = 220;
  const cellSize = 11;
  const cellGap = 3;
  const gridStartX = 45;
  const gridStartY = 25;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const body = d3.select(dom.window.document.body);
  
  const svg = body.append('div').attr('class', 'container')
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Styles
  svg.append('style').text(`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
    * { font-family: 'JetBrains Mono', monospace; }
  `);

  // Background
  svg.append('rect')
    .attr('x', 0).attr('y', 0).attr('rx', 8).attr('ry', 8)
    .attr('width', '100%').attr('height', '100%')
    .attr('fill', theme.background)
    .attr('stroke', theme.stroke)
    .attr('stroke-opacity', theme.strokeOpacity);

  // Title
  svg.append('text')
    .attr('x', 20).attr('y', 28)
    .attr('fill', theme.title)
    .attr('font-size', '16px')
    .attr('font-weight', '600')
    .text('True GitHub Commit Graph');

  // Subtitle
  svg.append('text')
    .attr('x', 220).attr('y', 28)
    .attr('fill', theme.text)
    .attr('font-size', '12px')
    .attr('opacity', 0.7)
    .text(`@${username} • Lines of Code`);

  const g = svg.append('g').attr('transform', 'translate(0, 40)');

  // Build weeks
  const startDate = new Date(yearStart);
  const endDate = new Date(yearEnd);
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());

  let maxLines = 100;
  for (const d of dailyContributions.values()) {
    if (d.totalLines > maxLines) maxLines = d.totalLines;
  }

  const weeks: { date: Date; contribution: DailyContribution | null }[][] = [];
  let currentDate = new Date(adjustedStart);

  while (currentDate <= endDate || weeks.length < 53) {
    const week: { date: Date; contribution: DailyContribution | null }[] = [];
    for (let day = 0; day < 7; day++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (currentDate >= startDate && currentDate <= endDate) {
        week.push({ date: new Date(currentDate), contribution: dailyContributions.get(dateStr) || null });
      } else {
        week.push({ date: new Date(currentDate), contribution: null });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 53) break;
  }

  // Month labels
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;
  weeks.forEach((week, weekIdx) => {
    const firstValid = week.find(d => d.contribution !== null || (d.date >= startDate && d.date <= endDate));
    if (firstValid) {
      const month = firstValid.date.getMonth();
      if (month !== lastMonth) {
        g.append('text')
          .attr('x', gridStartX + weekIdx * (cellSize + cellGap))
          .attr('y', gridStartY - 8)
          .attr('fill', theme.text)
          .attr('font-size', '9px')
          .attr('opacity', 0.6)
          .text(months[month]);
        lastMonth = month;
      }
    }
  });

  // Day labels
  ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach((label, idx) => {
    if (label) {
      g.append('text')
        .attr('x', gridStartX - 25)
        .attr('y', gridStartY + idx * (cellSize + cellGap) + cellSize - 2)
        .attr('fill', theme.text)
        .attr('font-size', '9px')
        .attr('opacity', 0.6)
        .text(label);
    }
  });

  // Cells
  weeks.forEach((week, weekIdx) => {
    week.forEach((day, dayIdx) => {
      if (day.date < startDate || day.date > endDate) return;
      const lines = day.contribution?.totalLines || 0;
      const level = getContributionLevel(lines, maxLines);
      g.append('rect')
        .attr('x', gridStartX + weekIdx * (cellSize + cellGap))
        .attr('y', gridStartY + dayIdx * (cellSize + cellGap))
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('fill', theme.levels[level]);
    });
  });

  // Stats
  g.append('text').attr('x', 720).attr('y', 35).attr('fill', theme.accent).attr('font-size', '20px').attr('font-weight', '600').text(formatNumber(totalLines));
  g.append('text').attr('x', 720).attr('y', 53).attr('fill', theme.text).attr('font-size', '10px').attr('opacity', 0.7).text('lines changed');
  g.append('text').attr('x', 720).attr('y', 85).attr('fill', theme.title).attr('font-size', '16px').attr('font-weight', '600').text(formatNumber(totalCommits));
  g.append('text').attr('x', 720).attr('y', 101).attr('fill', theme.text).attr('font-size', '10px').attr('opacity', 0.7).text('commits');

  // Legend
  g.append('text').attr('x', 45).attr('y', 140).attr('fill', theme.text).attr('font-size', '9px').attr('opacity', 0.6).text('Less');
  theme.levels.forEach((color, idx) => {
    g.append('rect').attr('x', 75 + idx * 13).attr('y', 130).attr('width', 11).attr('height', 11).attr('rx', 2).attr('fill', color);
  });
  g.append('text').attr('x', 145).attr('y', 140).attr('fill', theme.text).attr('font-size', '9px').attr('opacity', 0.6).text('More');

  return body.select('.container').html();
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { username, theme = 'github_dark', hide_border = 'false' } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username query parameter is required' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  try {
    const contributions = await fetchContributions(username, process.env.GITHUB_TOKEN);
    const selectedTheme = { ...getTheme(theme as string) };
    
    if (hide_border === 'true') {
      selectedTheme.strokeOpacity = 0;
    }

    const svg = createSVG(
      username,
      contributions.dailyContributions,
      contributions.totalLines,
      contributions.totalCommits,
      contributions.yearStart,
      contributions.yearEnd,
      selectedTheme
    );

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate graph' });
  }
}
