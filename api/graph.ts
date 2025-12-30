import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchContributionsLite } from '../src/github-api/fetch-contributions-lite';
import { createContributionGraphCard } from '../src/templates/contribution-graph-card';
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
    
    const selectedTheme = getTheme(theme as string);
    
    // Modify theme if hide_border is true
    if (hide_border === 'true') {
      selectedTheme.strokeOpacity = 0;
    }

    const svg = createContributionGraphCard(
      username,
      contributions.dailyContributions,
      contributions.totalLines,
      contributions.totalCommits,
      contributions.yearStart,
      contributions.yearEnd,
      selectedTheme
    );

    // Cache for 6 hours
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  } catch (error: any) {
    console.error('Error generating graph:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate graph' });
  }
}

