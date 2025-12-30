export interface Theme {
  name: string;
  title: string;
  text: string;
  background: string;
  stroke: string;
  strokeOpacity: number;
  // Contribution levels (5 levels: 0, 1-25%, 26-50%, 51-75%, 76-100%)
  levels: string[];
  accent: string;
}

export const ThemeMap = new Map<string, Theme>();

// GitHub Dark theme (default)
ThemeMap.set('github_dark', {
  name: 'github_dark',
  title: '#58a6ff',
  text: '#c9d1d9',
  background: '#0d1117',
  stroke: '#30363d',
  strokeOpacity: 1,
  levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  accent: '#58a6ff'
});

// GitHub Light theme
ThemeMap.set('github', {
  name: 'github',
  title: '#0366d6',
  text: '#24292e',
  background: '#ffffff',
  stroke: '#e1e4e8',
  strokeOpacity: 1,
  levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  accent: '#0366d6'
});

// Dracula theme
ThemeMap.set('dracula', {
  name: 'dracula',
  title: '#ff79c6',
  text: '#f8f8f2',
  background: '#282a36',
  stroke: '#44475a',
  strokeOpacity: 1,
  levels: ['#44475a', '#6272a4', '#8be9fd', '#50fa7b', '#ff79c6'],
  accent: '#bd93f9'
});

// Nord Dark theme
ThemeMap.set('nord_dark', {
  name: 'nord_dark',
  title: '#88c0d0',
  text: '#eceff4',
  background: '#2e3440',
  stroke: '#4c566a',
  strokeOpacity: 1,
  levels: ['#3b4252', '#5e81ac', '#81a1c1', '#88c0d0', '#8fbcbb'],
  accent: '#88c0d0'
});

// Tokyo Night theme
ThemeMap.set('tokyo_night', {
  name: 'tokyo_night',
  title: '#7aa2f7',
  text: '#a9b1d6',
  background: '#1a1b27',
  stroke: '#414868',
  strokeOpacity: 1,
  levels: ['#1f2335', '#3d59a1', '#7aa2f7', '#73daca', '#9ece6a'],
  accent: '#bb9af7'
});

// Radical theme
ThemeMap.set('radical', {
  name: 'radical',
  title: '#fe428e',
  text: '#a9fef7',
  background: '#141321',
  stroke: '#1a1831',
  strokeOpacity: 1,
  levels: ['#1a1831', '#7a1d47', '#fe428e', '#f8d847', '#a9fef7'],
  accent: '#f8d847'
});

// Monokai theme
ThemeMap.set('monokai', {
  name: 'monokai',
  title: '#f92672',
  text: '#f8f8f2',
  background: '#272822',
  stroke: '#3e3d32',
  strokeOpacity: 1,
  levels: ['#3e3d32', '#75715e', '#a6e22e', '#e6db74', '#f92672'],
  accent: '#ae81ff'
});

// Gruvbox theme
ThemeMap.set('gruvbox', {
  name: 'gruvbox',
  title: '#fabd2f',
  text: '#ebdbb2',
  background: '#282828',
  stroke: '#3c3836',
  strokeOpacity: 1,
  levels: ['#3c3836', '#689d6a', '#98971a', '#d79921', '#fabd2f'],
  accent: '#fe8019'
});

// Synthwave theme
ThemeMap.set('synthwave', {
  name: 'synthwave',
  title: '#f97e72',
  text: '#e0def4',
  background: '#241b2f',
  stroke: '#393552',
  strokeOpacity: 1,
  levels: ['#393552', '#6e6a86', '#eb6f92', '#f6c177', '#9ccfd8'],
  accent: '#c4a7e7'
});

// Catppuccin Mocha theme
ThemeMap.set('catppuccin', {
  name: 'catppuccin',
  title: '#cba6f7',
  text: '#cdd6f4',
  background: '#1e1e2e',
  stroke: '#313244',
  strokeOpacity: 1,
  levels: ['#313244', '#45475a', '#94e2d5', '#a6e3a1', '#cba6f7'],
  accent: '#f5c2e7'
});

export function getTheme(name: string): Theme {
  return ThemeMap.get(name) || ThemeMap.get('github_dark')!;
}

