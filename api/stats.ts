import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// ============ THEME ============
interface Theme {
  title: string;
  text: string;
  background: string;
  stroke: string;
  strokeOpacity: number;
  accent: string;
}

const themes: Record<string, Theme> = {
  github_dark: { title: '#58a6ff', text: '#c9d1d9', background: '#0d1117', stroke: '#30363d', strokeOpacity: 1, accent: '#58a6ff' },
  github: { title: '#0366d6', text: '#24292e', background: '#ffffff', stroke: '#e1e4e8', strokeOpacity: 1, accent: '#0366d6' },
  dracula: { title: '#ff79c6', text: '#f8f8f2', background: '#282a36', stroke: '#44475a', strokeOpacity: 1, accent: '#bd93f9' },
  tokyo_night: { title: '#7aa2f7', text: '#a9b1d6', background: '#1a1b27', stroke: '#414868', strokeOpacity: 1, accent: '#bb9af7' }
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
async function fetchStats(username: string, token: string) {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setDate(yearAgo.getDate() - 365);

  const reposQuery = `
    query GetRepos($login: String!) {
      user(login: $login) {
        repositories(first: 10, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
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
  let totalAdded = 0, totalDeleted = 0, totalCommits = 0;
  const contributingDays = new Set<string>();

  const since = yearAgo.toISOString();
  const until = now.toISOString();

  for (const repo of repos.slice(0, 6)) {
    try {
      const commitsRes = await axios.get(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&since=${since}&until=${until}&per_page=12`,
        { headers: { Authorization: `token ${token}` } }
      );

      for (const commit of commitsRes.data.slice(0, 8)) {
        try {
          const detail = await axios.get(
            `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits/${commit.sha}`,
            { headers: { Authorization: `token ${token}` } }
          );

          const date = detail.data.commit.author.date.split('T')[0];
          let added = 0, deleted = 0;

          if (detail.data.files) {
            for (const file of detail.data.files) {
              if (shouldFilterFile(file.filename)) continue;
              if (file.additions > 2000) continue;
              added += file.additions || 0;
              deleted += file.deletions || 0;
            }
          }

          if (added + deleted > 0) contributingDays.add(date);
          totalAdded += added;
          totalDeleted += deleted;
          totalCommits++;
        } catch { }
      }
    } catch { }
  }

  return { totalAdded, totalDeleted, totalCommits, contributingDays: contributingDays.size };
}

// ============ SVG ============
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function createStatsSVG(username: string, stats: any, theme: Theme): string {
  const width = 400, height = 195;
  const avgPerCommit = stats.totalCommits > 0 ? Math.round((stats.totalAdded + stats.totalDeleted) / stats.totalCommits) : 0;

  const statItems = [
    { label: 'Lines Changed', value: formatNumber(stats.totalAdded + stats.totalDeleted), color: theme.accent },
    { label: 'Lines Added', value: '+' + formatNumber(stats.totalAdded), color: '#3fb950' },
    { label: 'Lines Deleted', value: '-' + formatNumber(stats.totalDeleted), color: '#f85149' },
    { label: 'Commits', value: formatNumber(stats.totalCommits), color: theme.title },
    { label: 'Active Days', value: stats.contributingDays.toString(), color: theme.text },
    { label: 'Avg/Commit', value: formatNumber(avgPerCommit), color: '#f0883e' }
  ];

  const rows = statItems.map((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 20 : 210;
    const y = 70 + row * 35;
    const valueX = col === 0 ? 185 : 375;
    return `
      <text x="${x}" y="${y}" fill="${theme.text}" font-size="11" opacity="0.8">${item.label}</text>
      <text x="${valueX}" y="${y}" text-anchor="end" fill="${item.color}" font-size="13" font-weight="600">${item.value}</text>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&amp;display=swap');
    text { font-family: 'JetBrains Mono', monospace; }
  </style>
  <rect x="0" y="0" rx="8" ry="8" width="100%" height="100%" fill="${theme.background}" stroke="${theme.stroke}" stroke-opacity="${theme.strokeOpacity}"/>
  <text x="20" y="28" fill="${theme.title}" font-size="16" font-weight="600">${username}'s Code Stats</text>
  <text x="${width - 20}" y="28" text-anchor="end" fill="${theme.text}" font-size="10" opacity="0.5">Lines of Code Based</text>
  ${rows}
</svg>`;
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { username, theme = 'github_dark', hide_border = 'false' } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).send('Missing username parameter');
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).send('GITHUB_TOKEN not configured');
  }

  try {
    const stats = await fetchStats(username, process.env.GITHUB_TOKEN);
    const selectedTheme = getTheme(theme as string);
    if (hide_border === 'true') selectedTheme.strokeOpacity = 0;

    const svg = createStatsSVG(username, stats, selectedTheme);

    res.setHeader('Cache-Control', 'public, max-age=21600, s-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).send(svg);
  } catch (error: any) {
    return res.status(500).send(`Error: ${error.message}`);
  }
}
