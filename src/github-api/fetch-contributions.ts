import { graphqlRequest, restRequest } from '../utils/request';
import { FilterConfig } from '../const/config';

export interface DailyContribution {
  date: string; // YYYY-MM-DD format
  linesAdded: number;
  linesDeleted: number;
  totalLines: number; // added + deleted (total change)
  commits: number;
}

export interface ContributionData {
  username: string;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLines: number;
  totalCommits: number;
  filteredCommits: number; // commits that were filtered out
  dailyContributions: Map<string, DailyContribution>;
  yearStart: string;
  yearEnd: string;
}

interface Repository {
  name: string;
  owner: string;
  defaultBranch: string;
}

// Get user's repositories
async function getUserRepositories(token: string, username: string): Promise<Repository[]> {
  const query = `
    query GetUserRepos($login: String!, $first: Int!, $after: String) {
      user(login: $login) {
        repositories(first: $first, after: $after, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: {field: PUSHED_AT, direction: DESC}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            owner {
              login
            }
            defaultBranchRef {
              name
            }
            isPrivate
          }
        }
      }
    }
  `;

  const repos: Repository[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await graphqlRequest(token, query, {
      login: username,
      first: 100,
      after: cursor
    });

    if (response.data.errors) {
      console.error('Error fetching repositories:', response.data.errors);
      break;
    }

    const data = response.data.data.user.repositories;
    
    for (const repo of data.nodes) {
      if (repo.defaultBranchRef) {
        repos.push({
          name: repo.name,
          owner: repo.owner.login,
          defaultBranch: repo.defaultBranchRef.name
        });
      }
    }

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
  }

  return repos;
}

// Check if a file should be filtered out
function shouldFilterFile(filename: string, config: FilterConfig): boolean {
  const lowerFilename = filename.toLowerCase();
  
  // Check excluded paths
  for (const path of config.excludePaths) {
    if (lowerFilename.includes(path.toLowerCase())) {
      return true;
    }
  }
  
  // Check excluded extensions
  for (const ext of config.excludeExtensions) {
    if (lowerFilename.endsWith(`.${ext.toLowerCase()}`)) {
      return true;
    }
  }
  
  return false;
}

// Get commit stats with file-level filtering
async function getCommitStats(
  token: string,
  owner: string,
  repo: string,
  sha: string,
  config: FilterConfig
): Promise<{ additions: number; deletions: number; filtered: boolean }> {
  try {
    const response = await restRequest(token, `/repos/${owner}/${repo}/commits/${sha}`);
    const commit = response.data;
    
    let additions = 0;
    let deletions = 0;
    let wasFiltered = false;
    
    if (commit.files) {
      for (const file of commit.files) {
        // Filter by filename
        if (shouldFilterFile(file.filename, config)) {
          wasFiltered = true;
          continue;
        }
        
        // Filter by line count (mass data uploads)
        if (file.additions > config.maxLinesPerFile) {
          wasFiltered = true;
          continue;
        }
        
        additions += file.additions || 0;
        deletions += file.deletions || 0;
      }
    }
    
    return { additions, deletions, filtered: wasFiltered };
  } catch (error) {
    // If we can't get file-level stats, fall back to commit-level stats
    return { additions: 0, deletions: 0, filtered: false };
  }
}

// Get commits for a repository in the last year
async function getRepoCommits(
  token: string,
  username: string,
  repo: Repository,
  since: string,
  until: string,
  config: FilterConfig
): Promise<{ daily: Map<string, DailyContribution>; filtered: number }> {
  const daily = new Map<string, DailyContribution>();
  let filteredCount = 0;
  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const response = await restRequest(
        token,
        `/repos/${repo.owner}/${repo.name}/commits?author=${username}&since=${since}&until=${until}&per_page=${perPage}&page=${page}`
      );

      const commits = response.data;
      if (!commits || commits.length === 0) break;

      for (const commit of commits) {
        const date = commit.commit.author.date.split('T')[0];
        const stats = await getCommitStats(token, repo.owner, repo.name, commit.sha, config);
        
        if (stats.filtered) {
          filteredCount++;
        }

        // Skip if no meaningful changes after filtering
        if (stats.additions + stats.deletions < config.minLinesPerCommit) {
          continue;
        }

        if (!daily.has(date)) {
          daily.set(date, {
            date,
            linesAdded: 0,
            linesDeleted: 0,
            totalLines: 0,
            commits: 0
          });
        }

        const dayData = daily.get(date)!;
        dayData.linesAdded += stats.additions;
        dayData.linesDeleted += stats.deletions;
        dayData.totalLines += stats.additions + stats.deletions;
        dayData.commits++;
      }

      if (commits.length < perPage) break;
      page++;

      // Rate limiting protection
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Empty repository
        break;
      }
      console.error(`Error fetching commits for ${repo.owner}/${repo.name}:`, error.message);
      break;
    }
  }

  return { daily, filtered: filteredCount };
}

export async function fetchContributions(
  username: string,
  config: FilterConfig,
  daysBack: number = 365
): Promise<ContributionData> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setDate(yearAgo.getDate() - daysBack);
  
  const since = yearAgo.toISOString();
  const until = now.toISOString();

  console.log(`📊 Fetching contributions for ${username}...`);
  console.log(`   Date range: ${yearAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

  // Get all user repositories
  console.log('📁 Fetching repositories...');
  const repos = await getUserRepositories(token, username);
  console.log(`   Found ${repos.length} repositories`);

  // Aggregate contributions
  const dailyContributions = new Map<string, DailyContribution>();
  let totalFiltered = 0;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    process.stdout.write(`\r   Processing ${i + 1}/${repos.length}: ${repo.owner}/${repo.name}...`);
    
    const { daily, filtered } = await getRepoCommits(token, username, repo, since, until, config);
    totalFiltered += filtered;

    // Merge into main map
    for (const [date, data] of daily.entries()) {
      if (!dailyContributions.has(date)) {
        dailyContributions.set(date, { ...data });
      } else {
        const existing = dailyContributions.get(date)!;
        existing.linesAdded += data.linesAdded;
        existing.linesDeleted += data.linesDeleted;
        existing.totalLines += data.totalLines;
        existing.commits += data.commits;
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n');

  // Calculate totals
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  let totalCommits = 0;

  for (const data of dailyContributions.values()) {
    totalLinesAdded += data.linesAdded;
    totalLinesDeleted += data.linesDeleted;
    totalCommits += data.commits;
  }

  return {
    username,
    totalLinesAdded,
    totalLinesDeleted,
    totalLines: totalLinesAdded + totalLinesDeleted,
    totalCommits,
    filteredCommits: totalFiltered,
    dailyContributions,
    yearStart: yearAgo.toISOString().split('T')[0],
    yearEnd: now.toISOString().split('T')[0]
  };
}

