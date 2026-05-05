export const colors = {
  bg: '#070b12',
  surface: '#0f1624',
  surface2: '#151f33',
  border: '#243049',
  text: '#e8eefc',
  muted: '#8b9bb8',
  accent: '#5eead4',
  accentDim: '#2dd4bf',
  danger: '#fb7185',
  warning: '#fbbf24',
  rankGlow: '#38bdf8',
};

export const ranks = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof ranks)[number];
