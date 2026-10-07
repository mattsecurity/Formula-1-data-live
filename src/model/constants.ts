import type { Compound } from './types';

export const COMPOUND_COLORS: Record<Compound, string> = {
  SOFT: '#ff3b30',
  MEDIUM: '#ffd60a',
  HARD: '#f2f2f7',
  INTERMEDIATE: '#30d158',
  WET: '#0a84ff',
  UNKNOWN: '#8e8e93',
};

export const COMPOUND_LETTER: Record<Compound, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
  UNKNOWN: '?',
};

export const COMPOUND_NAME_IT: Record<Compound, string> = {
  SOFT: 'Soft',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  INTERMEDIATE: 'Intermedia',
  WET: 'Full wet',
  UNKNOWN: 'Sconosciuta',
};

export function normCompound(c: string | null | undefined): Compound {
  const u = (c ?? '').toUpperCase();
  if (u.startsWith('SOFT')) return 'SOFT';
  if (u.startsWith('MED')) return 'MEDIUM';
  if (u.startsWith('HARD')) return 'HARD';
  if (u.startsWith('INTER')) return 'INTERMEDIATE';
  if (u.startsWith('WET')) return 'WET';
  return 'UNKNOWN';
}

/** Fallback team colours when the API omits them. */
export const TEAM_COLORS: Record<string, string> = {
  'red bull racing': '#3671C6',
  mclaren: '#FF8000',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  'aston martin': '#229971',
  alpine: '#0093CC',
  williams: '#64C4FF',
  'racing bulls': '#6692FF',
  rb: '#6692FF',
  alphatauri: '#5E8FAA',
  'kick sauber': '#52E252',
  sauber: '#52E252',
  'alfa romeo': '#C92D4B',
  'haas f1 team': '#B6BABD',
  haas: '#B6BABD',
  audi: '#F50537',
  cadillac: '#C8A660',
};

export function teamColor(team: string | null | undefined, apiColour: string | null | undefined): string {
  if (apiColour && /^[0-9a-f]{6}$/i.test(apiColour)) return `#${apiColour}`;
  const k = (team ?? '').toLowerCase();
  for (const [name, c] of Object.entries(TEAM_COLORS)) if (k.includes(name)) return c;
  return '#8e8e93';
}

/** Points for finishing positions (Grand Prix and Sprint). */
export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
