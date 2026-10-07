import raw from './circuits.json';

/**
 * Real circuit outlines (© Tomislav Bacinger, MIT — github.com/bacinger/f1-circuits).
 * Points are metres in a local east/north frame, starting at the start/finish
 * line and following the racing direction.
 */
export interface CircuitGeo {
  id: string;
  name: string;
  location: string;
  length: number;
  altitude: number | null;
  firstGp: number | null;
  opened: number | null;
  polyLen: number;
  pts: number[];
}

export const CIRCUITS = raw as CircuitGeo[];

// OpenF1 circuit_short_name / location keywords → dataset id
const ALIASES: [RegExp, string][] = [
  [/sakhir|bahrain/i, 'bh-2002'],
  [/jeddah/i, 'sa-2021'],
  [/melbourne|albert park/i, 'au-1953'],
  [/suzuka/i, 'jp-1962'],
  [/shanghai/i, 'cn-2004'],
  [/miami/i, 'us-2022'],
  [/imola/i, 'it-1953'],
  [/monte carlo|monaco/i, 'mc-1929'],
  [/madring|madrid/i, 'es-2026'],
  [/catalunya|barcelona/i, 'es-1991'],
  [/montr[eé]al|gilles/i, 'ca-1978'],
  [/spielberg|red bull ring|austria/i, 'at-1969'],
  [/silverstone/i, 'gb-1948'],
  [/hungaroring|budapest/i, 'hu-1986'],
  [/spa/i, 'be-1925'],
  [/zandvoort/i, 'nl-1948'],
  [/monza/i, 'it-1922'],
  [/baku/i, 'az-2016'],
  [/singapore|marina bay/i, 'sg-2008'],
  [/austin|americas/i, 'us-2012'],
  [/mexico/i, 'mx-1962'],
  [/interlagos|s[aã]o paulo/i, 'br-1940'],
  [/las vegas/i, 'us-2023'],
  [/lusail|losail|qatar/i, 'qa-2004'],
  [/yas marina|abu dhabi/i, 'ae-2009'],
];

const byId = new Map(CIRCUITS.map((c) => [c.id, c]));

export function findCircuit(...names: (string | undefined | null)[]): CircuitGeo | undefined {
  for (const n of names) {
    if (!n) continue;
    for (const [re, id] of ALIASES) if (re.test(n)) return byId.get(id);
  }
  return undefined;
}

export function circuitById(id: string) {
  return byId.get(id);
}

/** SVG path of the outline fitted in a box (north up). */
export function outlinePath(c: CircuitGeo, w: number, h: number, pad = 8): { d: string; start: [number, number]; pts: [number, number][] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < c.pts.length; i += 2) {
    xs.push(c.pts[i]);
    ys.push(c.pts[i + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  const pts = xs.map((x, i) => [ox + (x - minX) * s, h - (oy + (ys[i] - minY) * s)] as [number, number]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + 'Z';
  return { d, start: pts[0], pts };
}

/**
 * Names of well-known corners by official turn number (FIA numbering, as
 * published in the circuit maps used by the F1 timing feed).
 */
export const CORNER_NAMES: Record<string, Record<string, string>> = {
  'it-1922': {
    '1': 'Variante del Rettifilo',
    '2': 'Variante del Rettifilo',
    '3': 'Curva Biassono',
    '4': 'Variante della Roggia',
    '5': 'Variante della Roggia',
    '6': 'Lesmo 1',
    '7': 'Lesmo 2',
    '8': 'Variante Ascari',
    '9': 'Variante Ascari',
    '10': 'Variante Ascari',
    '11': 'Curva Alboreto',
  },
  'gb-1948': {
    '1': 'Abbey',
    '2': 'Farm',
    '3': 'Village',
    '4': 'The Loop',
    '5': 'Aintree',
    '6': 'Brooklands',
    '7': 'Luffield',
    '8': 'Woodcote',
    '9': 'Copse',
    '10': 'Maggotts',
    '11': 'Becketts',
    '12': 'Becketts',
    '13': 'Chapel',
    '15': 'Stowe',
    '16': 'Vale',
    '17': 'Club',
    '18': 'Club',
  },
  'be-1925': { '1': 'La Source', '2': 'Eau Rouge', '3': 'Raidillon', '4': 'Raidillon', '5': 'Les Combes', '10': 'Pouhon', '18': 'Bus Stop', '19': 'Bus Stop' },
  'mc-1929': {
    '1': 'Sainte Dévote',
    '3': 'Massenet',
    '4': 'Casino',
    '5': 'Mirabeau Haute',
    '6': 'Grand Hotel Hairpin',
    '8': 'Portier',
    '9': 'Tunnel',
    '10': 'Nouvelle Chicane',
    '12': 'Tabac',
    '13': 'Piscine',
    '18': 'La Rascasse',
    '19': 'Anthony Noghès',
  },
  'jp-1962': { '1': 'First Curve', '3': 'S Curves', '8': 'Degner 1', '9': 'Degner 2', '11': 'Hairpin', '13': 'Spoon', '15': '130R', '16': 'Casio Triangle', '17': 'Casio Triangle' },
  'it-1953': { '2': 'Tamburello', '5': 'Villeneuve', '7': 'Tosa', '9': 'Piratella', '11': 'Acque Minerali', '14': 'Variante Alta', '17': 'Rivazza' },
  'nl-1948': { '1': 'Tarzanbocht', '3': 'Hugenholtzbocht', '7': 'Scheivlak', '14': 'Arie Luyendykbocht' },
  'at-1969': { '1': 'Niki Lauda', '3': 'Remus', '4': 'Schlossgold' },
  'br-1940': { '1': 'S do Senna', '3': 'Curva do Sol', '4': 'Descida do Lago', '6': 'Ferradura', '10': 'Bico de Pato', '12': 'Junção' },
  'ca-1978': { '1': 'Virage Senna', '10': "L'Épingle", '13': 'Mur des Champions', '14': 'Mur des Champions' },
  'az-2016': { '8': 'Castle' },
  'es-1991': { '1': 'Elf', '10': 'La Caixa' },
  'us-2012': { '1': 'Big Red', '12': 'Stadium' },
  'mx-1962': { '13': 'Foro Sol' },
};

export function cornerName(circuitId: string | undefined, num: string): string | undefined {
  return circuitId ? CORNER_NAMES[circuitId]?.[num] : undefined;
}
