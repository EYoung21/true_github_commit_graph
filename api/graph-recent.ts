import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// ============ THEME ============
interface Theme {
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
    title: '#58a6ff', text: '#c9d1d9', background: '#0d1117', stroke: '#30363d', strokeOpacity: 1,
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'], accent: '#58a6ff'
  },
  github: {
    title: '#0366d6', text: '#24292e', background: '#ffffff', stroke: '#e1e4e8', strokeOpacity: 1,
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], accent: '#0366d6'
  },
  dracula: {
    title: '#ff79c6', text: '#f8f8f2', background: '#282a36', stroke: '#44475a', strokeOpacity: 1,
    levels: ['#44475a', '#6272a4', '#8be9fd', '#50fa7b', '#ff79c6'], accent: '#bd93f9'
  },
  tokyo_night: {
    title: '#7aa2f7', text: '#a9b1d6', background: '#1a1b27', stroke: '#414868', strokeOpacity: 1,
    levels: ['#1f2335', '#3d59a1', '#7aa2f7', '#73daca', '#9ece6a'], accent: '#bb9af7'
  }
};

function getTheme(name: string): Theme {
  return { ...(themes[name] || themes.github_dark) };
}

// ============ FILTER ============
const excludeExtensions = ['json', 'csv', 'lock', 'svg', 'png', 'jpg', 'min.js', 'min.css', 'md', 'txt'];
const excludePaths = ['node_modules/', 'vendor/', 'dist/', 'build/', 'package-lock'];

function shouldFilterFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  for (const path of excludePaths) if (lower.includes(path)) return true;
  for (const ext of excludeExtensions) if (lower.endsWith(`.${ext}`)) return true;
  return false;
}

// ============ GITHUB API ============
interface CommitData {
  date: string;
  repo: string;
  message: string;
  lines: number;
  sha: string;
}

async function fetchRecentCommits(username: string, token: string, limit: number = 50) {
  const reposQuery = `
    query GetRepos($login: String!) {
      user(login: $login) {
        repositories(first: 30, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes { name, owner { login }, defaultBranchRef { name } }
        }
      }
    }
  `;

  const reposRes = await axios.post('https://api.github.com/graphql',
    { query: reposQuery, variables: { login: username } },
    { headers: { Authorization: `bearer ${token}` } }
  );

  if (reposRes.data.errors) throw new Error(reposRes.data.errors[0].message);

  const repos = reposRes.data.data.user.repositories.nodes.filter((r: any) => r.defaultBranchRef);
  const allCommits: CommitData[] = [];

  // Fetch recent commits from all repos in parallel
  const processRepo = async (repo: any) => {
    try {
      const commitsRes = await axios.get(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&per_page=10&sort=updated`,
        { headers: { Authorization: `token ${token}` } }
      );

      const processCommit = async (commit: any) => {
        try {
          const detail = await axios.get(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits/${commit.sha}`,
            { headers: { Authorization: `token ${token}` } }
          );

          const date = detail.data.commit.author.date.split('T')[0];
          let lines = 0;

          if (detail.data.files) {
            for (const file of detail.data.files) {
              if (shouldFilterFile(file.filename)) continue;
              if (file.additions > 2000) continue;
              lines += (file.additions || 0) + (file.deletions || 0);
            }
          }

          if (lines > 0) {
            return {
              date,
              repo: `${repo.owner.login}/${repo.name}`,
              message: detail.data.commit.message.split('\n')[0].substring(0, 60),
              lines,
              sha: commit.sha.substring(0, 7)
            };
          }
        } catch { }
        return null;
      };

      const commits = commitsRes.data.slice(0, 10);
      const batches = [];
      for (let i = 0; i < commits.length; i += 5) {
        batches.push(commits.slice(i, i + 5));
      }

      for (const batch of batches) {
        const results = await Promise.all(batch.map(processCommit));
        for (const result of results) {
          if (result) allCommits.push(result);
        }
      }
    } catch { }
  };

  // Process repos in batches of 5
  const repoBatches = [];
  for (let i = 0; i < Math.min(repos.length, 20); i += 5) {
    repoBatches.push(repos.slice(i, i + 5));
  }

  for (const batch of repoBatches) {
    await Promise.all(batch.map(processRepo));
  }

  // Sort by date (most recent first) and limit
  allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return allCommits.slice(0, limit);
}

// ============ SVG GENERATION ============
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getLevel(lines: number, max: number): number {
  if (lines === 0) return 0;
  const pct = lines / max;
  // Use more granular thresholds for better visual distinction
  if (pct <= 0.15) return 1;  // Very light
  if (pct <= 0.35) return 2;  // Light
  if (pct <= 0.60) return 3;  // Medium
  return 4;  // Bright
}

function createRecentCommitsSVG(
  username: string,
  commits: CommitData[],
  theme: Theme
): string {
  const width = 850;
  const cellSize = 11, cellGap = 3;
  const gridStartX = 45, gridStartY = 65;
  const gridHeight = 7 * (cellSize + cellGap); // 7 days

  // Group commits by date
  const dailyMap = new Map<string, { lines: number; count: number }>();
  let totalLines = 0, totalCommits = 0;
  let earliestDate: Date | null = null;

  for (const commit of commits) {
    if (!dailyMap.has(commit.date)) {
      dailyMap.set(commit.date, { lines: 0, count: 0 });
    }
    const day = dailyMap.get(commit.date)!;
    day.lines += commit.lines;
    day.count++;
    totalLines += commit.lines;
    totalCommits++;
    
    // Track earliest date
    const commitDate = new Date(commit.date);
    if (!earliestDate || commitDate < earliestDate) {
      earliestDate = commitDate;
    }
  }

  // Find actual max lines for better color scaling
  let maxLines = 0;
  for (const dayData of dailyMap.values()) {
    if (dayData.lines > maxLines) maxLines = dayData.lines;
  }
  // Ensure minimum for good color distribution
  maxLines = Math.max(maxLines, 50);

  // Use earliest commit date as start, or today if no commits
  const now = new Date();
  const startDate = earliestDate || now;
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());

  let cells = '';
  let monthLabels = '';
  let lastMonth = -1;
  let currentDate = new Date(adjustedStart);
  let weekIdx = 0;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Calculate number of weeks needed (max 53 weeks for full year)
  const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const maxWeeks = Math.min(Math.ceil(daysDiff / 7) + 1, 53);
  
  while (currentDate <= now && weekIdx < maxWeeks) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      if (currentDate >= startDate && currentDate <= now) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dailyMap.get(dateStr);
        const lines = dayData?.lines || 0;
        const level = getLevel(lines, maxLines);
        const x = gridStartX + weekIdx * (cellSize + cellGap);
        const y = gridStartY + dayIdx * (cellSize + cellGap);
        cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.levels[level]}"/>`;

        const month = currentDate.getMonth();
        if (dayIdx === 0 && month !== lastMonth) {
          monthLabels += `<text x="${x}" y="${gridStartY - 8}" fill="${theme.text}" font-size="9" opacity="0.6">${months[month]}</text>`;
          lastMonth = month;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weekIdx++;
  }

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, idx) =>
    label ? `<text x="${gridStartX - 28}" y="${gridStartY + idx * (cellSize + cellGap) + 9}" fill="${theme.text}" font-size="9" opacity="0.6">${label}</text>` : ''
  ).join('');

  // Position legend right below the grid
  const legendY = gridStartY + gridHeight + 25;
  const height = legendY + 20; // Dynamic height based on content
  
  const legend = `
    <text x="${gridStartX}" y="${legendY}" fill="${theme.text}" font-size="9" opacity="0.6">Less</text>
    ${theme.levels.map((c, i) => `<rect x="${gridStartX + 30 + i * 13}" y="${legendY - 10}" width="11" height="11" rx="2" fill="${c}"/>`).join('')}
    <text x="${gridStartX + 100}" y="${legendY}" fill="${theme.text}" font-size="9" opacity="0.6">More</text>
  `;

  const stats = `
    <text x="${width - 20}" y="32" text-anchor="end" fill="${theme.accent}" font-size="18" font-weight="600">${formatNumber(totalLines)}</text>
    <text x="${width - 20}" y="44" text-anchor="end" fill="${theme.text}" font-size="9" opacity="0.7">lines changed</text>
    <text x="${width - 20}" y="56" text-anchor="end" fill="${theme.title}" font-size="14" font-weight="600">${totalCommits}</text>
    <text x="${width - 20}" y="66" text-anchor="end" fill="${theme.text}" font-size="9" opacity="0.7">commits</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&amp;display=swap');
    text { font-family: 'JetBrains Mono', monospace; }
  </style>
  <rect x="0" y="0" rx="8" ry="8" width="100%" height="100%" fill="${theme.background}" stroke="${theme.stroke}" stroke-opacity="${theme.strokeOpacity}"/>
  <text x="20" y="28" fill="${theme.title}" font-size="16" font-weight="600">True GitHub Commit Graph</text>
  <text x="20" y="46" fill="${theme.text}" font-size="11" opacity="0.7">@${username} • Last ${totalCommits} Commits (excludes data files)</text>
  ${stats}
  ${monthLabels}
  ${dayLabels}
  ${cells}
  ${legend}
  <text x="${width - 20}" y="${legendY}" text-anchor="end" fill="${theme.text}" font-size="9" opacity="0.4">${startDate.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}</text>
</svg>`;
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { username, theme = 'github_dark', hide_border = 'false', limit = '50' } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).send('Missing username parameter');
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).send('GITHUB_TOKEN not configured');
  }

  try {
    const commits = await fetchRecentCommits(username, process.env.GITHUB_TOKEN, parseInt(limit as string, 10));
    const selectedTheme = getTheme(theme as string);
    if (hide_border === 'true') selectedTheme.strokeOpacity = 0;

    const svg = createRecentCommitsSVG(username, commits, selectedTheme);

    res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
}

