import { graphqlRequest, restRequest } from '../utils/request';
import { FilterConfig } from '../const/config';

export interface DailyContribution {
  date: string;
  linesAdded: number;
  linesDeleted: number;
  totalLines: number;
  commits: number;
}

export interface ContributionData {
  username: string;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLines: number;
  totalCommits: number;
  filteredCommits: number;
  dailyContributions: Map<string, DailyContribution>;
  yearStart: string;
  yearEnd: string;
}

interface RepoInfo {
  name: string;
  owner: string;
}

// Check if a file should be filtered out
function shouldFilterFile(filename: string, config: FilterConfig): boolean {
  const lowerFilename = filename.toLowerCase();
  
  for (const path of config.excludePaths) {
    if (lowerFilename.includes(path.toLowerCase())) {
      return true;
    }
  }
  
  for (const ext of config.excludeExtensions) {
    if (lowerFilename.endsWith(`.${ext.toLowerCase()}`)) {
      return true;
    }
  }
  
  return false;
}

// Lightweight fetch for Vercel (with timeouts and limits)
export async function fetchContributionsLite(
  username: string,
  config: FilterConfig,
  daysBack: number = 365
): Promise<ContributionData> {
  const token = process.env.GITHUB_TOKEN!;
  
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setDate(yearAgo.getDate() - daysBack);

  // Get user's recent repositories (limit for Vercel timeout)
  const reposQuery = `
    query GetRepos($login: String!) {
      user(login: $login) {
        repositories(first: 30, ownerAffiliations: [OWNER], orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes {
            name
            owner { login }
            defaultBranchRef { name }
          }
        }
      }
    }
  `;

  const reposResponse = await graphqlRequest(token, reposQuery, { login: username });
  
  if (reposResponse.data.errors) {
    throw new Error(reposResponse.data.errors[0].message);
  }

  const repos: RepoInfo[] = reposResponse.data.data.user.repositories.nodes
    .filter((r: any) => r.defaultBranchRef)
    .map((r: any) => ({ name: r.name, owner: r.owner.login }));

  const dailyContributions = new Map<string, DailyContribution>();
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  let totalCommits = 0;
  let filteredCommits = 0;

  const since = yearAgo.toISOString();
  const until = now.toISOString();

  // Process repos with a timeout-friendly approach
  for (const repo of repos.slice(0, 20)) { // Limit to 20 repos for Vercel
    try {
      const commitsResponse = await restRequest(
        token,
        `/repos/${repo.owner}/${repo.name}/commits?author=${username}&since=${since}&until=${until}&per_page=50`
      );

      const commits = commitsResponse.data;
      if (!commits || commits.length === 0) continue;

      for (const commit of commits.slice(0, 30)) { // Limit commits per repo
        try {
          const detailResponse = await restRequest(
            token,
            `/repos/${repo.owner}/${repo.name}/commits/${commit.sha}`
          );

          const detail = detailResponse.data;
          const date = detail.commit.author.date.split('T')[0];
          
          let additions = 0;
          let deletions = 0;
          let wasFiltered = false;

          if (detail.files) {
            for (const file of detail.files) {
              if (shouldFilterFile(file.filename, config)) {
                wasFiltered = true;
                continue;
              }
              if (file.additions > config.maxLinesPerFile) {
                wasFiltered = true;
                continue;
              }
              additions += file.additions || 0;
              deletions += file.deletions || 0;
            }
          }

          if (wasFiltered) filteredCommits++;

          if (!dailyContributions.has(date)) {
            dailyContributions.set(date, {
              date,
              linesAdded: 0,
              linesDeleted: 0,
              totalLines: 0,
              commits: 0
            });
          }

          const day = dailyContributions.get(date)!;
          day.linesAdded += additions;
          day.linesDeleted += deletions;
          day.totalLines += additions + deletions;
          day.commits++;

          totalLinesAdded += additions;
          totalLinesDeleted += deletions;
          totalCommits++;
        } catch {
          // Skip individual commit errors
        }
      }
    } catch {
      // Skip repo errors
    }
  }

  return {
    username,
    totalLinesAdded,
    totalLinesDeleted,
    totalLines: totalLinesAdded + totalLinesDeleted,
    totalCommits,
    filteredCommits,
    dailyContributions,
    yearStart: yearAgo.toISOString().split('T')[0],
    yearEnd: now.toISOString().split('T')[0]
  };
}

