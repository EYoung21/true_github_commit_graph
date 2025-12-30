import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

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
  dracula: { title: '#ff79c6', text: '#f8f8f2', background: '#282a36', stroke: '#44475a', strokeOpacity: 1, accent: '#bd93f9' }
};

function getTheme(name: string): Theme {
  return themes[name] || themes.github_dark;
}

// ============ FILTER ============
const excludeExtensions = ['json', 'csv', 'lock', 'svg', 'png', 'jpg', 'min.js', 'min.css'];
const excludePaths = ['node_modules/', 'vendor/', 'dist/', 'build/'];
const maxLinesPerFile = 2000;

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
        repositories(first: 25, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
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
  let totalAdded = 0, totalDeleted = 0, totalCommits = 0, contributingDays = new Set<string>();

  const since = yearAgo.toISOString();
  const until = now.toISOString();

  for (const repo of repos.slice(0, 15)) {
    try {
      const commitsRes = await axios.get(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&since=${since}&until=${until}&per_page=30`,
        { headers: { Authorization: `token ${token}` } }
      );

      for (const commit of commitsRes.data.slice(0, 20)) {
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
              if (file.additions > maxLinesPerFile) continue;
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
  const width = 400;
  const height = 195;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const body = d3.select(dom.window.document.body);

  const svg = body.append('div').attr('class', 'container')
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  svg.append('style').text(`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
    * { font-family: 'JetBrains Mono', monospace; }
  `);

  svg.append('rect')
    .attr('x', 0).attr('y', 0).attr('rx', 8).attr('ry', 8)
    .attr('width', '100%').attr('height', '100%')
    .attr('fill', theme.background)
    .attr('stroke', theme.stroke)
    .attr('stroke-opacity', theme.strokeOpacity);

  svg.append('text')
    .attr('x', 20).attr('y', 28)
    .attr('fill', theme.title)
    .attr('font-size', '16px')
    .attr('font-weight', '600')
    .text(`${username}'s Code Stats`);

  svg.append('text')
    .attr('x', width - 20).attr('y', 28)
    .attr('text-anchor', 'end')
    .attr('fill', theme.text)
    .attr('font-size', '10px')
    .attr('opacity', 0.5)
    .text('Lines of Code Based');

  const g = svg.append('g').attr('transform', 'translate(0, 50)');

  const statItems = [
    { label: 'Total Lines Changed', value: formatNumber(stats.totalAdded + stats.totalDeleted), color: theme.accent },
    { label: 'Lines Added', value: '+' + formatNumber(stats.totalAdded), color: '#3fb950' },
    { label: 'Lines Deleted', value: '-' + formatNumber(stats.totalDeleted), color: '#f85149' },
    { label: 'Total Commits', value: formatNumber(stats.totalCommits), color: theme.title },
    { label: 'Contributing Days', value: stats.contributingDays.toString(), color: theme.text },
    { label: 'Avg Lines/Commit', value: stats.totalCommits > 0 ? formatNumber(Math.round((stats.totalAdded + stats.totalDeleted) / stats.totalCommits)) : '0', color: '#f0883e' }
  ];

  statItems.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 20 : 210;
    const y = row * 35;

    g.append('text').attr('x', x).attr('y', y + 15).attr('fill', theme.text).attr('font-size', '11px').attr('opacity', 0.8).text(item.label);
    g.append('text').attr('x', col === 0 ? 185 : 375).attr('y', y + 15).attr('text-anchor', 'end').attr('fill', item.color).attr('font-size', '13px').attr('font-weight', '600').text(item.value);
  });

  return body.select('.container').html();
}

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { username, theme = 'github_dark', hide_border = 'false' } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  try {
    const stats = await fetchStats(username, process.env.GITHUB_TOKEN);
    const selectedTheme = { ...getTheme(theme as string) };
    if (hide_border === 'true') selectedTheme.strokeOpacity = 0;

    const svg = createStatsSVG(username, stats, selectedTheme);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed' });
  }
}
