export interface FilterConfig {
  // File extensions to exclude (e.g., 'json', 'csv', 'lock')
  excludeExtensions: string[];
  // Maximum lines per file change to count (files with more are considered data dumps)
  maxLinesPerFile: number;
  // Paths to exclude (e.g., 'vendor/', 'node_modules/')
  excludePaths: string[];
  // Minimum lines to count a commit (filter out trivial changes)
  minLinesPerCommit: number;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  excludeExtensions: [
    'json', 'csv', 'lock', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico',
    'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'webm', 'pdf',
    'min.js', 'min.css', 'bundle.js', 'chunk.js',
    'xml', 'yml', 'yaml', 'toml', 'md', 'txt', 'log',
    'sql', 'sqlite', 'db'
  ],
  maxLinesPerFile: 2000,
  excludePaths: [
    'vendor/', 'node_modules/', 'dist/', 'build/', '.git/',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '__pycache__/', '.venv/', 'venv/', 'env/',
    'Pods/', 'Carthage/'
  ],
  minLinesPerCommit: 0
};

export function getFilterConfig(): FilterConfig {
  const config = { ...DEFAULT_FILTER_CONFIG };
  
  if (process.env.EXCLUDE_EXTENSIONS) {
    config.excludeExtensions = process.env.EXCLUDE_EXTENSIONS.split(',').map(s => s.trim());
  }
  
  if (process.env.MAX_LINES_PER_FILE) {
    config.maxLinesPerFile = parseInt(process.env.MAX_LINES_PER_FILE, 10);
  }
  
  if (process.env.EXCLUDE_PATHS) {
    config.excludePaths = process.env.EXCLUDE_PATHS.split(',').map(s => s.trim());
  }
  
  return config;
}

