import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchContributionsLite } from '../src/github-api/fetch-contributions-lite';
import { createStatsCard, calculateStats } from '../src/templates/stats-card';
import { getTheme } from '../src/const/theme';
import { DEFAULT_FILTER_CONFIG, FilterConfig } from '../src/const/config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { 
    username,
    theme = 'github_dark',
    hide_border = 'false',
    max_lines_per_file = '2000'
  } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username query parameter is required' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'Server misconfigured: GITHUB_TOKEN not set' });
  }

  try {
    const filterConfig: FilterConfig = {
      ...DEFAULT_FILTER_CONFIG,
      maxLinesPerFile: parseInt(max_lines_per_file as string, 10) || 2000
    };

    const contributions = await fetchContributionsLite(username, filterConfig);
    
    const stats = calculateStats(
      contributions.dailyContributions,
      contributions.totalLinesAdded,
      contributions.totalLinesDeleted,
      contributions.totalCommits,
      contributions.filteredCommits,
      username
    );

    const selectedTheme = getTheme(theme as string);
    
    if (hide_border === 'true') {
      selectedTheme.strokeOpacity = 0;
    }

    const svg = createStatsCard(stats, selectedTheme);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('Error generating stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate stats' });
  }
}

