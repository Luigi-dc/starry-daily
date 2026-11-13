import * as THREE from "three";
import { milkyWayModel } from "./galaxy";
import { gauss, rng } from "./units";

/** Texture procedurali dell'Universo 3D, dipinte su canvas una volta sola e messe in cache. */

const cache = new Map<string, THREE.Texture>();

function canvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const el = document.createElement("canvas");
  el.width = el.height = size;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("contesto 2D non disponibile");
  return { canvas: el, ctx };
}

function finish(key: string, el: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

function cached(key: string, paint: () => HTMLCanvasElement): THREE.Texture {
  return cache.get(key) ?? finish(key, paint());
}

/** Sfocatura a box separabile su un buffer float. */
function blur(src: Float32Array, n: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < n; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * n + Math.min(n - 1, Math.max(0, x))];
    for (let x = 0; x < n; x++) {
      tmp[y * n + x] = acc / span;
      acc += src[y * n + Math.min(n - 1, x + radius + 1)] - src[y * n + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < n; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(n - 1, Math.max(0, y)) * n + x];
    for (let y = 0; y < n; y++) {
      out[y * n + x] = acc / span;
      acc += tmp[Math.min(n - 1, y + radius + 1) * n + x] - tmp[Math.max(0, y - radius) * n + x];
    }
  }
  return out;
}

/** Lato della texture della spirale, in anni luce: copre il disco della Via Lattea. */
export const SPIRAL_EXTENT_LY = 130000;

/** Vista dall'alto del modello della Via Lattea: è anche il volto delle altre galassie a spirale. */
export function spiralTexture(): THREE.Texture {
  return cached("spiral", () => {
    const n = 512;
    const model = milkyWayModel(90000, 7);
    const channels = [new Float32Array(n * n), new Float32Array(n * n), new Float32Array(n * n)];
    for (let i = 0; i < model.count; i++) {
      const u = model.positions[i * 3] / SPIRAL_EXTENT_LY + 0.5;
      const v = model.positions[i * 3 + 1] / SPIRAL_EXTENT_LY + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const px = Math.floor(u * n);
      const py = Math.floor((1 - v) * n);
      const w = model.alphas[i] * model.sizes[i];
      for (let c = 0; c < 3; c++) channels[c][py * n + px] += model.colors[i * 3 + c] * w;
    }
    const fine = channels.map((ch) => blur(ch, n, 1));
    const wide = channels.map((ch) => blur(blur(ch, n, 4), n, 4));
    const { canvas: el, ctx } = canvas(n);
    const image = ctx.createImageData(n, n);
    for (let p = 0; p < n * n; p++) {
      let max = 0;
      const rgb = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const value = fine[c][p] * 0.55 + wide[c][p] * 1.4;
        rgb[c] = 1 - Math.exp(-value * 0.9);
        max = Math.max(max, rgb[c]);
      }
      image.data[p * 4] = Math.round((rgb[0] / (max || 1)) * 255);
      image.data[p * 4 + 1] = Math.round((rgb[1] / (max || 1)) * 255);
      image.data[p * 4 + 2] = Math.round((rgb[2] / (max || 1)) * 255);
      image.data[p * 4 + 3] = Math.round(Math.min(1, max * 1.15) * 255);
    }
    ctx.putImageData(image, 0, 0);
    return el;
  });
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Array<[number, string]>): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, color] of stops) gradient.addColorStop(t, color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Alone morbido bianco: corona del Sole, stelle viste da vicino. */
export function glowTexture(): THREE.Texture {
  return cached("glow", () => {
    const { canvas: el, ctx } = canvas(256);
    radial(ctx, 128, 128, 128, [
      [0, "rgba(255,255,255,1)"],
      [0.08, "rgba(255,255,255,0.85)"],
      [0.22, "rgba(255,255,255,0.32)"],
      [0.5, "rgba(255,255,255,0.08)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    return el;
  });
}

export function ellipticalTexture(): THREE.Texture {
  return cached("elliptical", () => {
    const { canvas: el, ctx } = canvas(256);
    ctx.translate(128, 128);
    ctx.scale(1, 0.72);
    radial(ctx, 0, 0, 128, [
      [0, "rgba(255,246,228,1)"],
      [0.06, "rgba(255,234,200,0.9)"],
      [0.2, "rgba(250,214,170,0.45)"],
      [0.45, "rgba(235,196,150,0.16)"],
      [1, "rgba(220,180,140,0)"],
    ]);
    return el;
  });
}

function clumps(ctx: CanvasRenderingContext2D, rand: () => number, count: number, spread: number, colors: string[], size: number): void {
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const x = 128 + gauss(rand) * spread;
    const y = 128 + gauss(rand) * spread * 0.7;
    const color = colors[Math.floor(rand() * colors.length)];
    radial(ctx, x, y, size * (0.4 + rand()), [
      [0, color],
      [1, "rgba(0,0,0,0)"],
    ]);
  }
  ctx.globalCompositeOperation = "source-over";
}

export function irregularTexture(): THREE.Texture {
  return cached("irregular", () => {
    const { canvas: el, ctx } = canvas(256);
    const rand = rng(91);
    radial(ctx, 128, 128, 110, [
      [0, "rgba(190,205,255,0.35)"],
      [1, "rgba(190,205,255,0)"],
    ]);
    clumps(ctx, rand, 70, 34, ["rgba(170,195,255,0.5)", "rgba(220,230,255,0.45)", "rgba(255,130,180,0.55)"], 18);
    return el;
  });
}

export function dwarfTexture(): THREE.Texture {
  return cached("dwarf", () => {
    const { canvas: el, ctx } = canvas(128);
    radial(ctx, 64, 64, 64, [
      [0, "rgba(255,238,210,0.75)"],
      [0.3, "rgba(250,225,190,0.3)"],
      [1, "rgba(240,210,170,0)"],
    ]);
    return el;
  });
}

/** Ammasso di galassie: alone di gas caldo e decine di galassie concentrate al centro. */
export function clusterTexture(): THREE.Texture {
  return cached("cluster", () => {
    const { canvas: el, ctx } = canvas(256);
    const rand = rng(17);
    radial(ctx, 128, 128, 128, [
      [0, "rgba(190,160,255,0.35)"],
      [0.4, "rgba(150,130,255,0.12)"],
      [1, "rgba(120,110,255,0)"],
    ]);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 160; i++) {
      const r = Math.abs(gauss(rand)) * 34 + rand() * 20;
      const a = rand() * Math.PI * 2;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      const s = 1.5 + rand() * rand() * 7;
      radial(ctx, x, y, s, [
        [0, "rgba(255,240,215,0.95)"],
        [1, "rgba(255,220,180,0)"],
      ]);
    }
    return el;
  });
}

/** Filamento («muraglia») di galassie. */
export function wallTexture(): THREE.Texture {
  return cached("wall", () => {
    const { canvas: el, ctx } = canvas(256);
    const rand = rng(23);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 520; i++) {
      const t = rand();
      const x = 12 + t * 232;
      const y = 128 + Math.sin(t * 7.5) * 26 + gauss(rand) * 9;
      const s = 1.5 + rand() * 5;
      radial(ctx, x, y, s, [
        [0, rand() < 0.6 ? "rgba(200,185,255,0.6)" : "rgba(255,225,190,0.6)"],
        [1, "rgba(0,0,0,0)"],
      ]);
    }
    return el;
  });
}

/** Grande vuoto: un anello di galassie attorno a una bolla quasi vuota. */
export function voidTexture(): THREE.Texture {
  return cached("void", () => {
    const { canvas: el, ctx } = canvas(256);
    const rand = rng(31);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 420; i++) {
      const a = rand() * Math.PI * 2;
      const r = 92 + gauss(rand) * 14;
      const s = 1.2 + rand() * 3.5;
      radial(ctx, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, s, [
        [0, "rgba(190,190,255,0.55)"],
        [1, "rgba(0,0,0,0)"],
      ]);
    }
    return el;
  });
}

/** Nebulosa: nubi sovrapposte del colore indicato, nucleo più luminoso. */
export function nebulaTexture(color: string): THREE.Texture {
  return cached(`nebula-${color}`, () => {
    const { canvas: el, ctx } = canvas(256);
    const rand = rng(parseInt(color.slice(1), 16));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 46; i++) {
      const x = 128 + gauss(rand) * 30;
      const y = 128 + gauss(rand) * 30;
      const s = 20 + rand() * 50;
      const tint = rand() < 0.3 ? [255, 200, 170] : [r, g, b];
      radial(ctx, x, y, s, [
        [0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.22)`],
        [1, "rgba(0,0,0,0)"],
      ]);
    }
    radial(ctx, 128, 128, 26, [
      [0, "rgba(255,255,255,0.7)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    return el;
  });
}

/** Anello di Saturno in coordinate radiali, come nella scheda. */
export { saturnRingTexture, surfaceTexture, hasSurface } from "../three/planet";
