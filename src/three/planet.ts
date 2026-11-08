import * as THREE from "three";

/**
 * Superfici procedurali dei corpi del sistema solare.
 * Le texture sono dipinte su canvas al primo uso e messe in cache: nessuna immagine esterna.
 * Lo stesso disegno serve la sfera della scheda (PlanetView) e i pianeti dentro la mappa.
 */

const TEX_W = 1024;
const TEX_H = 512;

type Ctx = CanvasRenderingContext2D;
type Stop = [number, string];

const SEEDS: Record<string, number> = {
  sun: 11,
  moon: 27,
  mercury: 41,
  venus: 58,
  earth: 167,
  mars: 73,
  jupiter: 97,
  saturn: 113,
  uranus: 131,
  neptune: 149,
};

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("contesto 2D non disponibile");
  return { canvas, ctx };
}

/** Generatore pseudocasuale deterministico: la superficie di un pianeta è sempre la stessa. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mixStops(stops: Stop[], t: number): [number, number, number] {
  const clamped = Math.min(Math.max(t, 0), 1);
  for (let i = 1; i < stops.length; i += 1) {
    const [t1, c1] = stops[i];
    if (clamped <= t1) {
      const [t0, c0] = stops[i - 1];
      const k = t1 === t0 ? 0 : (clamped - t0) / (t1 - t0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** Bande orizzontali con leggera ondulazione: la base dei giganti gassosi. */
function paintBands(ctx: Ctx, w: number, h: number, stops: Stop[], bands: number, rand: () => number): void {
  for (let y = 0; y < h; y += 1) {
    const t = y / (h - 1);
    const [r, g, b] = mixStops(stops, t);
    const drift = Math.sin(t * Math.PI * bands) * 0.055 + (rand() - 0.5) * 0.03;
    const k = 1 + drift;
    ctx.fillStyle = `rgb(${clampByte(r * k)}, ${clampByte(g * k)}, ${clampByte(b * k)})`;
    ctx.fillRect(0, y, w, 1);
  }
}

/** Venature turbolente: ellissi allungate, ridisegnate oltre i bordi per non lasciare cuciture. */
function addTurbulence(
  ctx: Ctx,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const rx = 22 + rand() * 180;
    const ry = 1.4 + rand() * 6.5;
    ctx.globalAlpha = alpha * (0.25 + rand() * 0.75);
    ctx.fillStyle = rand() > 0.5 ? "#ffffff" : "#2a1405";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (x < rx) {
      ctx.beginPath();
      ctx.ellipse(x + w, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (x > w - rx) {
      ctx.beginPath();
      ctx.ellipse(x - w, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Macchie chiare o scure diffuse: mari lunari, regioni di albedo, nubi. */
function addBlobs(
  ctx: Ctx,
  w: number,
  h: number,
  rand: () => number,
  count: number,
  color: string,
  alpha: number,
  size: number,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = h * 0.12 + rand() * h * 0.76;
    const rx = size * (0.4 + rand() * 0.9);
    const ry = size * (0.2 + rand() * 0.55);
    ctx.globalAlpha = alpha * (0.35 + rand() * 0.65);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    if (x < rx) {
      ctx.beginPath();
      ctx.ellipse(x + w, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Crateri: bordo chiaro, fondo in ombra, diametri con distribuzione realistica. */
function addCraters(ctx: Ctx, w: number, h: number, rand: () => number, count: number, scale: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = h * 0.06 + rand() * h * 0.88;
    const r = (1.4 + Math.pow(rand(), 2.4) * 24) * scale;
    const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.08, x, y, r);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.32)");
    gradient.addColorStop(0.62, "rgba(0, 0, 0, 0.17)");
    gradient.addColorStop(0.84, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Calotte polari con bordo irregolare. */
function addPolarCaps(ctx: Ctx, w: number, h: number, rand: () => number, depth: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h * depth);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.62)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h * depth);

  const south = ctx.createLinearGradient(0, h * depth * 0.6, 0, h);
  south.addColorStop(0, "rgba(255, 255, 255, 0)");
  south.addColorStop(0.62, "rgba(250, 252, 255, 0.6)");
  south.addColorStop(1, "rgba(255, 255, 255, 0.9)");
  ctx.fillStyle = south;
  ctx.fillRect(0, h * depth * 0.6, w, h * (1 - depth * 0.6));

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  for (let i = 0; i < 160; i += 1) {
    const x = rand() * w;
    const y = h * depth * (0.5 + rand() * 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rand() * 16, 2 + rand() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSurface(ctx: Ctx, w: number, h: number, id: string, rand: () => number): void {
  switch (id) {
    case "sun": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#fff6ce"],
          [0.4, "#ffdc86"],
          [0.75, "#ffbe54"],
          [1, "#ff9f32"],
        ],
        4,
        rand,
      );
      for (let i = 0; i < 2600; i += 1) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 1 + Math.pow(rand(), 3) * 9;
        ctx.globalAlpha = 0.05 + rand() * 0.16;
        ctx.fillStyle = rand() > 0.45 ? "#fffbe6" : "#e8852a";
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "moon": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#ececed"],
          [0.3, "#cfcfd4"],
          [0.55, "#dedee2"],
          [0.8, "#c6c6cc"],
          [1, "#e2e2e6"],
        ],
        3,
        rand,
      );
      addBlobs(ctx, w, h, rand, 16, "#5e626e", 0.34, 70);
      addCraters(ctx, w, h, rand, 520, 1);
      addCraters(ctx, w, h, rand, 260, 0.35);
      break;
    }
    case "mercury": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#c2bbb1"],
          [0.35, "#9b948b"],
          [0.65, "#b1a9a0"],
          [1, "#8d867d"],
        ],
        3,
        rand,
      );
      addBlobs(ctx, w, h, rand, 12, "#6b645c", 0.28, 62);
      addCraters(ctx, w, h, rand, 620, 0.9);
      break;
    }
    case "venus": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#f8eed2"],
          [0.35, "#efd9a6"],
          [0.62, "#f6e6c1"],
          [1, "#e2c78f"],
        ],
        5,
        rand,
      );
      addTurbulence(ctx, w, h, rand, 900, 0.1);
      addBlobs(ctx, w, h, rand, 26, "#fff8e2", 0.16, 110);
      break;
    }
    case "earth": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#0a3a72"],
          [0.32, "#0d5590"],
          [0.62, "#0a4a86"],
          [1, "#0c3a6e"],
        ],
        3,
        rand,
      );

      // continenti: gruppi di ellissi verdi e brune
      for (let i = 0; i < 24; i += 1) {
        const cx = rand() * w;
        const cy = h * 0.14 + rand() * h * 0.72;
        ctx.fillStyle = rand() > 0.35 ? "#2f6b3a" : "#7c6a3f";
        ctx.globalAlpha = 0.72 + rand() * 0.28;
        for (let k = 0; k < 5; k += 1) {
          ctx.beginPath();
          ctx.ellipse(
            cx + (rand() - 0.5) * 80,
            cy + (rand() - 0.5) * 56,
            26 + rand() * 86,
            16 + rand() * 58,
            rand() * Math.PI,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      addPolarCaps(ctx, w, h, rand, 0.06);

      // nuvole
      for (let i = 0; i < 240; i += 1) {
        ctx.globalAlpha = 0.05 + rand() * 0.18;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(rand() * w, rand() * h, 18 + rand() * 78, 7 + rand() * 24, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "mars": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#d8875a"],
          [0.3, "#bd6136"],
          [0.58, "#a44b28"],
          [0.82, "#8f3d20"],
          [1, "#7a3018"],
        ],
        4,
        rand,
      );
      addBlobs(ctx, w, h, rand, 22, "#5d2a17", 0.32, 88);
      addBlobs(ctx, w, h, rand, 14, "#e09a6a", 0.18, 60);
      addCraters(ctx, w, h, rand, 320, 0.7);
      addPolarCaps(ctx, w, h, rand, 0.08);
      break;
    }
    case "jupiter": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#c8ab84"],
          [0.12, "#efe1c4"],
          [0.24, "#bb8f60"],
          [0.36, "#f2e7cd"],
          [0.48, "#a87a4c"],
          [0.6, "#eddfc1"],
          [0.72, "#b98c5c"],
          [0.86, "#e9d8b6"],
          [1, "#c4a074"],
        ],
        11,
        rand,
      );
      addTurbulence(ctx, w, h, rand, 1500, 0.16);
      const spotX = w * 0.66;
      const spotY = h * 0.63;
      ctx.save();
      ctx.translate(spotX, spotY);
      ctx.scale(2.1, 1);
      const spot = ctx.createRadialGradient(0, 0, 4, 0, 0, 74);
      spot.addColorStop(0, "rgba(198, 98, 58, 0.95)");
      spot.addColorStop(0.55, "rgba(176, 82, 48, 0.7)");
      spot.addColorStop(1, "rgba(176, 82, 48, 0)");
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case "saturn": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#e2d2a8"],
          [0.2, "#f4ead0"],
          [0.4, "#d8c296"],
          [0.58, "#f0e4c6"],
          [0.76, "#cdb489"],
          [1, "#e8dbba"],
        ],
        9,
        rand,
      );
      addTurbulence(ctx, w, h, rand, 620, 0.09);
      break;
    }
    case "uranus": {
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#cdf3f6"],
          [0.4, "#b1e6ec"],
          [0.72, "#c6f0f4"],
          [1, "#a5dee6"],
        ],
        3,
        rand,
      );
      addBlobs(ctx, w, h, rand, 18, "#ffffff", 0.1, 130);
      break;
    }
    default: {
      // nettuno
      paintBands(
        ctx,
        w,
        h,
        [
          [0, "#5578d8"],
          [0.3, "#3c5dc2"],
          [0.62, "#4d70d2"],
          [1, "#33509f"],
        ],
        4,
        rand,
      );
      addTurbulence(ctx, w, h, rand, 420, 0.1);
      addBlobs(ctx, w, h, rand, 10, "#eef4ff", 0.16, 90);
      ctx.fillStyle = "rgba(22, 34, 82, 0.55)";
      ctx.beginPath();
      ctx.ellipse(w * 0.38, h * 0.42, 46, 24, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

const textureCache = new Map<string, THREE.Texture>();

/** Texture della superficie del corpo (1024×512), condivisa e in cache. */
export function surfaceTexture(id: string): THREE.Texture {
  const cached = textureCache.get(id);
  if (cached) return cached;

  const { canvas, ctx } = makeCanvas(TEX_W, TEX_H);
  paintSurface(ctx, TEX_W, TEX_H, id, rng(SEEDS[id] ?? 17));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  textureCache.set(id, texture);
  return texture;
}

/** Materiale del Sole: il disco si scurisce verso il bordo, come una stella vera. */
export function sunSurfaceMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vec3 base = texture2D(uMap, vUv).rgb;
        float facing = clamp(vNormalView.z, 0.0, 1.0);
        float limb = 0.58 + 0.62 * pow(facing, 0.55);
        gl_FragColor = vec4(base * limb, 1.0);
      }
    `,
  });
}

let ringTextureCache: THREE.Texture | null = null;

/** Anelli di Saturno: gradiente radiale con la divisione di Cassini. */
export function saturnRingTexture(): THREE.Texture {
  if (ringTextureCache) return ringTextureCache;
  const { canvas, ctx } = makeCanvas(512, 8);
  const gradient = ctx.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0.0, "rgba(214, 199, 170, 0)");
  gradient.addColorStop(0.05, "rgba(226, 213, 186, 0.5)");
  gradient.addColorStop(0.28, "rgba(242, 233, 208, 0.88)");
  gradient.addColorStop(0.4, "rgba(188, 173, 146, 0.32)");
  gradient.addColorStop(0.5, "rgba(248, 240, 217, 0.92)");
  gradient.addColorStop(0.64, "rgba(210, 196, 168, 0.62)");
  gradient.addColorStop(0.72, "rgba(140, 128, 108, 0.16)");
  gradient.addColorStop(0.8, "rgba(238, 228, 202, 0.82)");
  gradient.addColorStop(0.93, "rgba(206, 192, 166, 0.4)");
  gradient.addColorStop(1.0, "rgba(206, 192, 166, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  ringTextureCache = texture;
  return texture;
}

const FOV = 28;

/** Inclinazione dell'asse (radianti) e velocità di rotazione: valori riconoscibili a occhio. */
const AXIS_TILT: Record<string, number> = {
  sun: 0.12,
  moon: 0.06,
  mercury: 0.001,
  venus: 3.0,
  mars: 0.44,
  jupiter: 0.05,
  saturn: 0.47,
  uranus: 1.71,
  neptune: 0.49,
};

const SPIN: Record<string, number> = {
  sun: 0.06,
  moon: 0.05,
  mercury: 0.03,
  venus: -0.02,
  mars: 0.18,
  jupiter: 0.34,
  saturn: 0.3,
  uranus: 0.2,
  neptune: 0.2,
};

/** Sfera 3D del corpo celeste mostrata nella scheda. */
export class PlanetView {
  private readonly renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly holder = new THREE.Group();
  private readonly observer: ResizeObserver | null = null;

  private body: THREE.Mesh | null = null;
  private bodyId: string | null = null;
  private extent = 1.05;
  private spin = 0.2;
  private frame = 0;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
    } catch {
      this.renderer = null;
    }

    this.scene.add(this.holder);

    const key = new THREE.DirectionalLight(0xfff3e0, 3.1);
    key.position.set(-2.6, 1.5, 2.6);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x6d8dff, 0.85);
    rim.position.set(2.6, -1.1, -1.8);
    this.scene.add(rim);

    this.scene.add(new THREE.AmbientLight(0x2c3852, 1.1));

    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(canvas);
    }
  }

  /** Mostra il corpo indicato; restituisce false se WebGL non è disponibile. */
  show(id: string): boolean {
    if (!this.renderer) return false;
    if (this.bodyId !== id) this.build(id);
    this.start();
    return true;
  }

  hide(): void {
    this.stop();
  }

  private build(id: string): void {
    this.disposeBody();

    const texture = surfaceTexture(id);
    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const mesh =
      id === "sun"
        ? new THREE.Mesh(geometry, sunSurfaceMaterial(texture))
        : new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94, metalness: 0.02 }),
          );
    mesh.rotation.z = AXIS_TILT[id] ?? 0.2;
    this.holder.add(mesh);
    this.body = mesh;

    if (id === "saturn") {
      const inner = 1.34;
      const outer = 2.42;
      const ringGeometry = new THREE.RingGeometry(inner, outer, 180, 1);
      const positions = ringGeometry.attributes.position;
      const uvs = ringGeometry.attributes.uv;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const radius = Math.hypot(x, y);
        uvs.setXY(i, (radius - inner) / (outer - inner), 0.5);
      }
      uvs.needsUpdate = true;

      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({
          map: saturnRingTexture(),
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          opacity: 0.96,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      this.holder.add(ring);
      this.holder.rotation.set(0.34, 0, 0.2);
      this.extent = 2.44;
    } else {
      this.holder.rotation.set(0.14, 0, 0.05);
      this.extent = 1.04;
    }

    this.spin = SPIN[id] ?? 0.2;
    this.bodyId = id;
    this.fit();
  }

  private disposeBody(): void {
    for (const child of [...this.holder.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
      this.holder.remove(child);
    }
    this.body = null;
  }

  private fit(): void {
    if (!this.renderer) return;
    const width = this.canvas.clientWidth || 240;
    const height = this.canvas.clientHeight || 220;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);

    const fill = this.extent > 1.4 ? 0.9 : 0.66;
    const tan = Math.tan((FOV * Math.PI) / 360);
    const distance = this.extent / (fill * tan * Math.min(1, this.camera.aspect));
    this.camera.position.set(0, distance * 0.07, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);
    if (this.body) this.body.rotation.y += this.spin * 0.012;
    this.renderer?.render(this.scene, this.camera);
  };
}
