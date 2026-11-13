/**
 * Unità e sistemi di riferimento dell'Universo 3D.
 * Tutte le posizioni sono in anni luce, nel riferimento equatoriale J2000, espresse con gli assi
 * di three.js: x verso RA 0h, y verso il polo nord celeste, z verso RA 18h (destrorso).
 */

export const AU = 1.58125074e-5; // anni luce
export const KM = 1.05700083e-13; // anni luce
export const PC = 3.26156; // anni luce

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
export const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

const DEG = Math.PI / 180;

/** Da coordinate equatoriali cartesiane (X verso RA 0, Z verso nord) agli assi di three.js. */
export const fromEquatorial = (x: number, y: number, z: number): V3 => ({ x, y: z, z: -y });

/** Direzione (RA in ore, Dec in gradi) e distanza → posizione. */
export function fromRaDec(raHours: number, decDeg: number, distance: number): V3 {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  return fromEquatorial(distance * Math.cos(dec) * Math.cos(ra), distance * Math.cos(dec) * Math.sin(ra), distance * Math.sin(dec));
}

const OBLIQUITY = 23.4393 * DEG;

/** Da coordinate eclittiche (le stesse di solar.ts) alla posizione equatoriale di three.js. */
export function fromEcliptic(x: number, y: number, z: number, unit = 1): V3 {
  const ye = y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY);
  const ze = y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
  return fromEquatorial(x * unit, ye * unit, ze * unit);
}

/**
 * Assi galattici espressi nel riferimento equatoriale (righe della matrice IAU equatoriale → galattico):
 * X verso il centro galattico, Y nel verso della rotazione (l = 90°), Z verso il polo nord galattico.
 */
const GAL_ROWS: Array<[number, number, number]> = [
  [-0.0548755604, -0.873437090, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
export const GAL_X = fromEquatorial(...GAL_ROWS[0]);
export const GAL_Y = fromEquatorial(...GAL_ROWS[1]);
export const GAL_Z = fromEquatorial(...GAL_ROWS[2]);

/** Distanza del Sole dal centro galattico (anni luce). */
export const GALACTIC_CENTER_LY = 26700;
export const GALACTIC_CENTER = scale(GAL_X, GALACTIC_CENTER_LY);

/** Da coordinate galattiche locali (centrate sul centro galattico) alla posizione nel riferimento comune. */
export function fromGalactic(x: number, y: number, z: number): V3 {
  return add(GALACTIC_CENTER, add(add(scale(GAL_X, x), scale(GAL_Y, y)), scale(GAL_Z, z)));
}

/** Ricava la distanza in anni luce da testi come «1.344 anni luce» o «2,5 milioni di anni luce». */
export function parseLightYears(text: string): number | null {
  const match = text.match(/([\d.,]+)\s*(milioni|miliardi)?\s*(?:di\s*)?anni luce/);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return value * (match[2] === "miliardi" ? 1e9 : match[2] === "milioni" ? 1e6 : 1);
}

const nf = (value: number, digits = 0) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Distanza leggibile, nell'unità più adatta (km, UA, anni luce…). */
export function distanceLabel(ly: number): string {
  if (ly < 0.5 * AU) {
    const km = ly / KM;
    return km >= 1e6 ? `${nf(km / 1e6, km < 1e7 ? 1 : 0)} milioni di km` : `${nf(km)} km`;
  }
  if (ly < 0.05) return `${nf(ly / AU, ly / AU < 10 ? 1 : 0)} UA`;
  if (ly < 1e3) return `${nf(ly, ly < 10 ? 1 : 0)} anni luce`;
  if (ly < 1e6) return `${nf(ly / 1e3, ly < 1e4 ? 1 : 0)} mila anni luce`;
  if (ly < 1e9) return `${nf(ly / 1e6, ly < 1e7 ? 1 : 0)} milioni di anni luce`;
  return `${nf(ly / 1e9, ly < 1e10 ? 1 : 0)} miliardi di anni luce`;
}

/** Hash deterministico di un testo in [0, 1). */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/** Generatore pseudocasuale deterministico. */
export function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Numero casuale con distribuzione normale (Box–Muller). */
export function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
