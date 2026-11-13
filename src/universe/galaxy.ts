import { gauss, rng } from "./units";

/**
 * Modello della Via Lattea in coordinate galattiche locali (anni luce, centro galattico nell'origine,
 * X verso il Sole opposto: il Sole sta in (−26.700, 0, 0), Y nel verso della rotazione, Z verso il polo nord).
 * Bulge, barra, quattro bracci a spirale logaritmica (passo ~12°), lo Sperone di Orione dove sta il Sole,
 * disco diffuso e alone di ammassi globulari. La rotazione è oraria vista dal polo nord: i bracci sono «trascinati».
 */

export interface PointCloud {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  count: number;
}

export function makeCloud(count: number): PointCloud {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    alphas: new Float32Array(count),
    count,
  };
}

export function setPoint(
  cloud: PointCloud,
  i: number,
  x: number,
  y: number,
  z: number,
  color: [number, number, number],
  size: number,
  alpha: number,
): void {
  cloud.positions[i * 3] = x;
  cloud.positions[i * 3 + 1] = y;
  cloud.positions[i * 3 + 2] = z;
  cloud.colors[i * 3] = color[0];
  cloud.colors[i * 3 + 1] = color[1];
  cloud.colors[i * 3 + 2] = color[2];
  cloud.sizes[i] = size;
  cloud.alphas[i] = alpha;
}

const PITCH_K = Math.tan((12 * Math.PI) / 180);
/** Raggio del braccio del Sagittario nella direzione del Sole: gli altri bracci sono sfasati di 90°. */
const ARM_R0 = 22000;
const SUN_ANGLE = Math.PI;

export interface ArmInfo {
  name: string;
  /** Scostamento di fase (multipli di 90°). */
  phase: number;
}

export const ARMS: ArmInfo[] = [
  { name: "Braccio del Sagittario-Carena", phase: 0 },
  { name: "Braccio di Perseo", phase: -1 },
  { name: "Braccio Scudo-Centauro", phase: 1 },
  { name: "Braccio Esterno", phase: -2 },
];

/** Angolo del braccio a un dato raggio. */
export function armAngle(phase: number, r: number): number {
  return SUN_ANGLE + (phase * Math.PI) / 2 + Math.log(r / ARM_R0) / PITCH_K;
}

const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const WARM: [number, number, number] = [1, 0.72, 0.42];
const OLD: [number, number, number] = [1, 0.85, 0.66];
const YOUNG: [number, number, number] = [0.45, 0.62, 1];
const HII: [number, number, number] = [1, 0.3, 0.55];

export function milkyWayModel(count = 140000, seed = 42): PointCloud {
  const rand = rng(seed);
  const cloud = makeCloud(count);
  const barAngle = (27 * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const pick = rand();
    let x = 0;
    let y = 0;
    let z = 0;
    let color = OLD;
    let size = 1.4;
    let alpha = 0.22;

    if (pick < 0.13) {
      // bulge
      x = gauss(rand) * 3400;
      y = gauss(rand) * 2600;
      z = gauss(rand) * 2100;
      color = mix(WARM, OLD, rand() * 0.5);
      alpha = 0.2;
      size = 1.5;
    } else if (pick < 0.2) {
      // barra
      const along = (rand() * 2 - 1) * 15000 * Math.sqrt(rand());
      const across = gauss(rand) * 1500;
      x = along * Math.cos(Math.PI - barAngle) - across * Math.sin(Math.PI - barAngle);
      y = along * Math.sin(Math.PI - barAngle) + across * Math.cos(Math.PI - barAngle);
      z = gauss(rand) * 900;
      color = mix(WARM, OLD, rand());
      alpha = 0.18;
    } else if (pick < 0.72) {
      // bracci
      const arm = ARMS[Math.floor(rand() * ARMS.length)];
      const r = 9000 + Math.pow(rand(), 1.35) * 48000;
      const theta = armAngle(arm.phase, r);
      const width = 900 + r * 0.035;
      const offR = gauss(rand) * width;
      const offT = gauss(rand) * width * 0.6;
      x = (r + offR) * Math.cos(theta) - offT * Math.sin(theta);
      y = (r + offR) * Math.sin(theta) + offT * Math.cos(theta);
      z = gauss(rand) * 380;
      const knot = rand();
      if (knot < 0.05) {
        color = HII;
        size = 2.2;
        alpha = 0.5;
      } else if (knot < 0.32) {
        color = YOUNG;
        size = 1.9;
        alpha = 0.32;
      } else {
        color = mix(YOUNG, OLD, rand() * 0.45);
        alpha = 0.15;
      }
    } else if (pick < 0.735) {
      // Sperone di Orione, attorno al Sole
      const t = rand();
      const r = 24000 + t * 6000;
      const theta = SUN_ANGLE - 0.3 + t * 0.45;
      x = r * Math.cos(theta) + gauss(rand) * 1100;
      y = r * Math.sin(theta) + gauss(rand) * 1100;
      z = gauss(rand) * 350;
      color = mix(YOUNG, OLD, rand() * 0.6);
      alpha = 0.14;
      size = 1.6;
    } else if (pick < 0.998) {
      // disco diffuso
      const r = -Math.log(1 - rand() * 0.995) * 11000;
      const theta = rand() * Math.PI * 2;
      x = r * Math.cos(theta);
      y = r * Math.sin(theta);
      z = gauss(rand) * 750;
      color = mix(OLD, WARM, rand() * 0.4);
      alpha = 0.09;
    } else {
      // ammassi globulari dell'alone
      x = gauss(rand) * 30000;
      y = gauss(rand) * 30000;
      z = gauss(rand) * 26000;
      color = WARM;
      alpha = 0.8;
      size = 2.6;
    }
    setPoint(cloud, i, x, y, z, color, size, alpha);
  }
  return cloud;
}
