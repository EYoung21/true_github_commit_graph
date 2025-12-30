import { fetchContributions } from './github-api/fetch-contributions';
import { createContributionGraphCard } from './templates/contribution-graph-card';
import { createStatsCard, calculateStats } from './templates/stats-card';
import { getFilterConfig } from './const/config';
import { getTheme, ThemeMap } from './const/theme';
import { writeSVG, writeJSON } from './utils/file-writer';

async function main() {
  const username = process.env.GITHUB_USERNAME;
  const themeName = process.env.THEME || 'github_dark';
  const outputDir = process.env.OUTPUT_DIR || './output';

  if (!username) {
    console.error('❌ GITHUB_USERNAME environment variable is required');
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          TRUE GITHUB COMMIT GRAPH GENERATOR                ║');
  console.log('║      Measuring contributions by Lines of Code              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const filterConfig = getFilterConfig();
  console.log('🔧 Filter Configuration:');
  console.log(`   Max lines per file: ${filterConfig.maxLinesPerFile}`);
  console.log(`   Excluded extensions: ${filterConfig.excludeExtensions.slice(0, 5).join(', ')}...`);
  console.log('');

  try {
    // Fetch contribution data
    const contributions = await fetchContributions(username, filterConfig);

    console.log('📈 Results:');
    console.log(`   Total lines added: ${contributions.totalLinesAdded.toLocaleString()}`);
    console.log(`   Total lines deleted: ${contributions.totalLinesDeleted.toLocaleString()}`);
    console.log(`   Total lines changed: ${contributions.totalLines.toLocaleString()}`);
    console.log(`   Total commits: ${contributions.totalCommits.toLocaleString()}`);
    console.log(`   Filtered commits: ${contributions.filteredCommits.toLocaleString()}`);
    console.log('');

    // Calculate additional stats
    const stats = calculateStats(
      contributions.dailyContributions,
      contributions.totalLinesAdded,
      contributions.totalLinesDeleted,
      contributions.totalCommits,
      contributions.filteredCommits,
      username
    );

    // Generate cards for each theme
    console.log('🎨 Generating cards...');
    
    for (const [name, theme] of ThemeMap.entries()) {
      // Generate contribution graph
      const graphSvg = createContributionGraphCard(
        username,
        contributions.dailyContributions,
        contributions.totalLines,
        contributions.totalCommits,
        contributions.yearStart,
        contributions.yearEnd,
        theme
      );
      writeSVG(outputDir, `contribution-graph-${name}`, graphSvg);

      // Generate stats card
      const statsSvg = createStatsCard(stats, theme);
      writeSVG(outputDir, `stats-${name}`, statsSvg);
    }

    // Also generate with user's preferred theme as the default
    const preferredTheme = getTheme(themeName);
    const defaultGraphSvg = createContributionGraphCard(
      username,
      contributions.dailyContributions,
      contributions.totalLines,
      contributions.totalCommits,
      contributions.yearStart,
      contributions.yearEnd,
      preferredTheme
    );
    writeSVG(outputDir, 'contribution-graph', defaultGraphSvg);

    const defaultStatsSvg = createStatsCard(stats, preferredTheme);
    writeSVG(outputDir, 'stats', defaultStatsSvg);

    // Save raw data as JSON for further analysis
    const rawData = {
      username,
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: contributions.yearStart,
        end: contributions.yearEnd
      },
      totals: {
        linesAdded: contributions.totalLinesAdded,
        linesDeleted: contributions.totalLinesDeleted,
        totalLines: contributions.totalLines,
        totalCommits: contributions.totalCommits,
        filteredCommits: contributions.filteredCommits
      },
      stats: {
        contributingDays: stats.contributingDays,
        longestStreak: stats.longestStreak,
        currentStreak: stats.currentStreak,
        avgLinesPerDay: Math.round(stats.avgLinesPerDay),
        avgLinesPerCommit: Math.round(stats.avgLinesPerCommit)
      },
      dailyContributions: Object.fromEntries(contributions.dailyContributions)
    };
    writeJSON(outputDir, 'contribution-data', rawData);

    console.log('');
    console.log('✨ Done! Cards generated in:', outputDir);
    console.log('');
    console.log('📋 Usage in GitHub README:');
    console.log(`   ![True GitHub Commit Graph](./output/contribution-graph.svg)`);
    console.log(`   ![Code Stats](./output/stats.svg)`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

