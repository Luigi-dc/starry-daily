import * as THREE from "three";
import skyData from "../data/sky.json";
import { surfaceTexture, sunSurfaceMaterial } from "./planet";

export interface SkyTarget {
  id: string;
  name: string;
  kind: string;
  ra: number;
  dec: number;
  /** Immagine reale dell'oggetto (foto dei telescopi), se disponibile. */
  image?: string;
}

export interface SkyHandlers {
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
}

export const KIND_COLOR: Record<string, number> = {
  nebula: 0xff6fc8,
  galaxy: 0xffc06a,
  cluster: 0x8fc4ff,
  remnant: 0x66f0d4,
  blackhole: 0xb992ff,
  planet: 0xcfe8ff,
  moon: 0xe6ebf5,
  sun: 0xffd45e,
};

interface SkyCatalog {
  stars: number[][];
  constellations: Array<{ id: string; name: string; ra: number; dec: number; lines: number[][][] }>;
}

const catalog = skyData as unknown as SkyCatalog;

const RADIUS = 420;
const BASE_FOV = 62;
const FOCUS_FOV = 38;
const MIN_FOV = 22;
const MAX_FOV = 86;

/** Dimensione dei billboard con le foto reali, per tipo di oggetto. */
const PHOTO_SCALE: Record<string, number> = {
  nebula: 132,
  galaxy: 116,
  cluster: 74,
  remnant: 96,
  blackhole: 58,
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function dirFromRaDec(raHours: number, decDeg: number, radius = 1): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(raHours * 15);
  const dec = THREE.MathUtils.degToRad(decDeg);
  return new THREE.Vector3(Math.cos(dec) * Math.cos(ra), Math.sin(dec), -Math.cos(dec) * Math.sin(ra)).multiplyScalar(
    radius,
  );
}

function radialTexture(size = 128): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ringTexture(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(half, half, half - 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(half + Math.cos(a) * (half - 26), half + Math.sin(a) * (half - 26));
    ctx.lineTo(half + Math.cos(a) * (half - 6), half + Math.sin(a) * (half - 6));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Maschera radiale: fa sfumare i bordi delle foto nel buio del cielo. */
function softEdgeTexture(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, half * 0.1, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.48, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.76, "rgba(255,255,255,0.34)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function pointMaterial(map: THREE.Texture, opacity = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: opacity },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 tint;
      uniform float uPixelRatio;
      varying vec3 vTint;
      void main() {
        vTint = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (380.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec3 vTint;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        if (tex.a < 0.01) discard;
        gl_FragColor = vec4(vTint, tex.a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Colore approssimato di una stella dall'indice di colore B−V. */
function bvColor(bv: number): [number, number, number] {
  if (bv < 0) return [0.7, 0.8, 1.0];
  if (bv < 0.3) return [0.84, 0.9, 1.0];
  if (bv < 0.6) return [1.0, 0.98, 0.96];
  if (bv < 0.9) return [1.0, 0.95, 0.85];
  if (bv < 1.2) return [1.0, 0.86, 0.69];
  if (bv < 1.6) return [1.0, 0.76, 0.55];
  return [1.0, 0.65, 0.47];
}

/** Cielo reale: ogni punto è una stella del catalogo, con luminosità e colore veri. */
function buildStarField(map: THREE.Texture): THREE.Points {
  const stars = catalog.stars;
  const count = stars.length;
  const positions = new Float32Array(count * 3);
  const tints = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const dir = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    const [ra, dec, mag, bv] = stars[i];
    dir.copy(dirFromRaDec(ra, dec, RADIUS * 0.998));
    positions[i * 3] = dir.x;
    positions[i * 3 + 1] = dir.y;
    positions[i * 3 + 2] = dir.z;

    const brightness = Math.pow(Math.max(0, 6.5 - mag), 1.32);
    sizes[i] = 1.35 + brightness * 0.62;

    const [r, g, b] = bvColor(bv);
    const saturation = clamp(brightness / 7, 0.18, 0.95);
    tints[i * 3] = 1 - (1 - r) * saturation;
    tints[i * 3 + 1] = 1 - (1 - g) * saturation;
    tints[i * 3 + 2] = 1 - (1 - b) * saturation;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const points = new THREE.Points(geo, pointMaterial(map, 0.95));
  points.frustumCulled = false;
  return points;
}

/** Polvere e stelle della Via Lattea lungo il piano galattico. */
function buildMilkyWay(map: THREE.Texture, count = 24000): THREE.Points {
  const positions = new Float32Array(count * 3);
  const tints = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const pole = dirFromRaDec(12.85932, 27.12825);
  const center = dirFromRaDec(17.76033, -28.93617);
  const gz = pole.clone().normalize();
  const gx = center.clone().normalize();
  const gy = new THREE.Vector3().crossVectors(gz, gx).normalize();
  const v = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const l = Math.random() * Math.PI * 2;
    const b = ((Math.random() + Math.random() + Math.random() + Math.random()) / 4 - 0.5) * 0.62;
    v.set(0, 0, 0)
      .addScaledVector(gx, Math.cos(b) * Math.cos(l))
      .addScaledVector(gy, Math.cos(b) * Math.sin(l))
      .addScaledVector(gz, Math.sin(b))
      .normalize()
      .multiplyScalar(RADIUS * 0.994);

    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;

    const warm = Math.random() < 0.42;
    tints[i * 3] = warm ? 1 : 0.74;
    tints[i * 3 + 1] = warm ? 0.88 : 0.82;
    tints[i * 3 + 2] = warm ? 0.72 : 1;
    sizes[i] = 1.5 + Math.random() * 4.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const points = new THREE.Points(geo, pointMaterial(map, 0.3));
  points.frustumCulled = false;
  return points;
}

/** Bagliore diffuso della Via Lattea: senza, la banda resta invisibile. */
function buildGalacticGlow(map: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  const pole = dirFromRaDec(12.85932, 27.12825).normalize();
  const center = dirFromRaDec(17.76033, -28.93617).normalize();
  const gz = pole;
  const gx = center;
  const gy = new THREE.Vector3().crossVectors(gz, gx).normalize();
  const v = new THREE.Vector3();

  for (let i = 0; i < 340; i++) {
    const l = Math.random() * Math.PI * 2;
    const b = (Math.random() + Math.random() - 1) * 0.16;
    v.set(0, 0, 0)
      .addScaledVector(gx, Math.cos(b) * Math.cos(l))
      .addScaledVector(gy, Math.cos(b) * Math.sin(l))
      .addScaledVector(gz, Math.sin(b))
      .normalize()
      .multiplyScalar(RADIUS * 0.988);

    const nearCenter = Math.max(0, Math.cos(l));
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        color: new THREE.Color().setHSL(0.09 - nearCenter * 0.02, 0.45, 0.62),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.035 + nearCenter * 0.03,
      }),
    );
    sprite.position.copy(v);
    sprite.scale.setScalar(110 + Math.random() * 130);
    group.add(sprite);
  }

  return group;
}

/** Figure delle costellazioni dalle linee reali. */
function buildConstellations(): THREE.LineSegments {
  const vertices: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (const constellation of catalog.constellations) {
    for (const line of constellation.lines) {
      for (let i = 1; i < line.length; i += 1) {
        const [ra0, dec0] = line[i - 1];
        const [ra1, dec1] = line[i];
        // evita il segmento che attraversa tutto il cielo quando si supera RA 24h
        const wrap = Math.abs(ra1 - ra0) > 12 ? (ra1 > ra0 ? -24 : 24) : 0;
        a.copy(dirFromRaDec(ra0, dec0, RADIUS * 0.982));
        b.copy(dirFromRaDec(ra1 + wrap, dec1, RADIUS * 0.982));
        vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x63a8e8,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return lines;
}

function buildGrid(): THREE.LineSegments {
  const segments: number[] = [];
  const r = RADIUS * 0.99;
  const raToRad = (h: number) => THREE.MathUtils.degToRad(h * 15);

  const push = (a: THREE.Vector3, b: THREE.Vector3) => segments.push(a.x, a.y, a.z, b.x, b.y, b.z);

  for (let dec = -75; dec <= 75; dec += 15) {
    const d = THREE.MathUtils.degToRad(dec);
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 96; i++) {
      const ra = (i / 96) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(d) * Math.cos(ra), Math.sin(d), -Math.cos(d) * Math.sin(ra)).multiplyScalar(r);
      if (prev) push(prev, p);
      prev = p;
    }
  }

  for (let h = 0; h < 24; h += 2) {
    const ra = raToRad(h);
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 72; i++) {
      const dec = THREE.MathUtils.degToRad(-88 + (i / 72) * 176);
      const p = new THREE.Vector3(
        Math.cos(dec) * Math.cos(ra),
        Math.sin(dec),
        -Math.cos(dec) * Math.sin(ra),
      ).multiplyScalar(r);
      if (prev) push(prev, p);
      prev = p;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x2a4d78,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return lines;
}

export class SkyView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly byId = new Map<string, SkyTarget>();
  private readonly nodes = new Map<string, THREE.Object3D>();
  private readonly labels = new Map<string, HTMLButtonElement>();
  private readonly constellationLabels: Array<{ el: HTMLElement; ra: number; dec: number }> = [];
  private readonly spinning: THREE.Mesh[] = [];
  private readonly reticle: THREE.Sprite;
  private readonly starMap: THREE.Texture;
  private readonly softEdge: THREE.Texture;
  private readonly handlers: SkyHandlers;
  private readonly constellationLines: THREE.LineSegments;
  private anisotropy = 1;

  private showConstellations = false;
  private yaw = 0;
  private pitch = 0;
  private yawTarget = 0;
  private pitchTarget = 0;
  private fovTarget = BASE_FOV;

  private dragging = false;
  private travel = 0;
  private lastX = 0;
  private lastY = 0;
  private idle = 0;
  private animating = true;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private filterKind: string | null = null;

  private readonly onResize = () => this.resize();
  private readonly vec = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly labelLayer: HTMLElement,
    targets: SkyTarget[],
    handlers: SkyHandlers = {},
  ) {
    this.handlers = handlers;
    for (const t of targets) this.byId.set(t.id, t);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setClearColor(0x03040a, 1);
    this.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene.background = new THREE.Color(0x03040a);
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 4000);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(0, 0, 0);

    this.starMap = radialTexture(64);
    this.softEdge = softEdgeTexture();

    const skyGroup = new THREE.Group();
    skyGroup.add(buildGalacticGlow(this.starMap));
    skyGroup.add(buildMilkyWay(this.starMap));
    skyGroup.add(buildStarField(this.starMap));
    skyGroup.add(buildGrid());
    this.constellationLines = buildConstellations();
    this.constellationLines.visible = false;
    skyGroup.add(this.constellationLines);
    this.scene.add(skyGroup);

    // i pianeti ricevono la luce dalla direzione in cui si trova il Sole
    const sunTarget = targets.find((target) => target.kind === "sun");
    const sunDir = sunTarget
      ? dirFromRaDec(sunTarget.ra, sunTarget.dec, 1).normalize()
      : new THREE.Vector3(1, 0, 0);
    const sunlight = new THREE.DirectionalLight(0xfff6e6, 2.9);
    sunlight.position.copy(sunDir.clone().multiplyScalar(600));
    this.scene.add(sunlight);
    this.scene.add(new THREE.AmbientLight(0x30405e, 1.5));

    for (const target of targets) {
      const node = this.buildNode(target);
      this.scene.add(node);
      this.nodes.set(target.id, node);

      const label = document.createElement("button");
      label.type = "button";
      label.className = "obj-label";
      label.textContent = target.name;
      label.dataset.id = target.id;
      if (!target.image && target.kind !== "planet" && target.kind !== "moon" && target.kind !== "sun") {
        label.classList.add("is-minor");
      }
      label.addEventListener("click", (event) => {
        event.stopPropagation();
        this.focus(target.id);
        this.handlers.onSelect?.(target.id);
      });
      label.addEventListener("pointerenter", () => this.setHover(target.id));
      label.addEventListener("pointerleave", () => this.setHover(null));
      this.labelLayer.appendChild(label);
      this.labels.set(target.id, label);
    }

    for (const constellation of catalog.constellations) {
      const el = document.createElement("span");
      el.className = "constellation-label";
      el.textContent = constellation.name.toUpperCase();
      this.labelLayer.appendChild(el);
      this.constellationLabels.push({ el, ra: constellation.ra, dec: constellation.dec });
    }

    this.reticle = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: ringTexture(),
        color: 0x9fe8ff,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    this.reticle.scale.setScalar(38);
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    const start = dirFromRaDec(5.6, -8);
    this.yaw = this.yawTarget = Math.atan2(-start.x, -start.z);
    this.pitch = this.pitchTarget = Math.asin(clamp(start.y, -1, 1));

    this.resize();
    this.bindEvents();
    this.renderer.setAnimationLoop(this.tick);
  }

  /** Costruisce il nodo 3D di un oggetto: foto reale, sfera del pianeta oppure alone. */
  private buildNode(target: SkyTarget): THREE.Object3D {
    const group = new THREE.Group();
    group.position.copy(dirFromRaDec(target.ra, target.dec, RADIUS * 0.97));
    group.userData.id = target.id;
    group.userData.baseScale = 1;

    const color = KIND_COLOR[target.kind] ?? 0x9ec8ff;

    if (target.kind === "planet" || target.kind === "moon" || target.kind === "sun") {
      const radius = target.kind === "sun" ? 15 : target.kind === "moon" ? 13 : 12;
      const texture = surfaceTexture(target.id);
      const material =
        target.kind === "sun"
          ? sunSurfaceMaterial(texture)
          : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.02 });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
      sphere.rotation.z = 0.25;
      group.add(sphere);
      this.spinning.push(sphere);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.starMap,
          color,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          opacity: target.kind === "sun" ? 0.42 : 0.14,
        }),
      );
      halo.scale.setScalar(radius * (target.kind === "sun" ? 3.2 : 1.85));
      group.add(halo);
      return group;
    }

    if (target.image) {
      const size = PHOTO_SCALE[target.kind] ?? 90;

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.starMap,
          color,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.24,
        }),
      );
      halo.scale.setScalar(size * 1.5);
      group.add(halo);

      const texture = new THREE.TextureLoader().load(target.image, (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = this.anisotropy;
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.anisotropy;

      const photo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          alphaMap: this.softEdge,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.92,
        }),
      );
      photo.scale.setScalar(size);
      group.add(photo);
      return group;
    }

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.starMap,
        color,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      }),
    );
    glow.scale.setScalar(22);
    group.add(glow);
    return group;
  }

  getViewCenter(): { ra: number; dec: number } {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const dec = THREE.MathUtils.radToDeg(Math.asin(clamp(dir.y, -1, 1)));
    let ra = THREE.MathUtils.radToDeg(Math.atan2(-dir.z, dir.x)) / 15;
    if (ra < 0) ra += 24;
    return { ra, dec };
  }

  focus(id: string): void {
    const target = this.byId.get(id);
    if (!target) return;
    const dir = dirFromRaDec(target.ra, target.dec);
    this.pitchTarget = clamp(Math.asin(clamp(dir.y, -1, 1)), -1.45, 1.45);
    let yaw = Math.atan2(-dir.x, -dir.z);
    while (yaw - this.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2;
    this.yawTarget = yaw;
    this.fovTarget = FOCUS_FOV;
    this.selectedId = id;
    this.animating = true;
    this.idle = 0;

    this.reticle.position.copy(dirFromRaDec(target.ra, target.dec, RADIUS * 0.96));
    this.reticle.visible = true;
    this.syncSelectionStyles();
  }

  clearFocus(): void {
    this.selectedId = null;
    this.fovTarget = BASE_FOV;
    this.animating = true;
    this.reticle.visible = false;
    this.syncSelectionStyles();
  }

  zoom(step: number): void {
    this.fovTarget = clamp(this.fovTarget + step, MIN_FOV, MAX_FOV);
    this.idle = 0;
  }

  setFilter(kind: string | null): void {
    this.filterKind = kind;
    for (const [id, label] of this.labels) {
      const target = this.byId.get(id);
      const dim = kind !== null && target?.kind !== kind;
      label.classList.toggle("is-dim", dim);
    }
    for (const [id, node] of this.nodes) {
      const target = this.byId.get(id);
      node.visible = !(kind !== null && target?.kind !== kind);
    }
  }

  /** Mostra o nasconde le figure e i nomi delle costellazioni. */
  setConstellations(visible: boolean): void {
    this.showConstellations = visible;
    this.constellationLines.visible = visible;
    for (const { el } of this.constellationLabels) {
      if (!visible) el.style.opacity = "0";
    }
  }

  private syncSelectionStyles(): void {
    for (const [id, label] of this.labels) label.classList.toggle("is-selected", id === this.selectedId);
    for (const [id, node] of this.nodes) {
      const base = (node.userData.baseScale as number) ?? 1;
      node.scale.setScalar(id === this.selectedId ? base * 1.18 : base);
    }
  }

  private setHover(id: string | null): void {
    if (this.hoveredId === id) return;
    this.hoveredId = id;
    for (const [key, label] of this.labels) label.classList.toggle("is-hover", key === id);
    this.canvas.style.cursor = id ? "pointer" : "grab";
    this.handlers.onHover?.(id);
  }

  private pick(clientX: number, clientY: number): SkyTarget | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: SkyTarget | null = null;
    let bestDist = 26;

    for (const target of this.byId.values()) {
      const label = this.labels.get(target.id);
      if (label?.classList.contains("is-dim")) continue;
      const node = this.nodes.get(target.id);
      if (node && !node.visible) continue;
      this.vec.copy(node ? node.position : dirFromRaDec(target.ra, target.dec, RADIUS)).project(this.camera);
      if (this.vec.z > 1) continue;
      const px = (this.vec.x * 0.5 + 0.5) * rect.width;
      const py = (-this.vec.y * 0.5 + 0.5) * rect.height;
      const dist = Math.hypot(px - x, py - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = target;
      }
    }
    return best;
  }

  private bindEvents(): void {
    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.travel = 0;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.idle = 0;
      this.animating = false;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        const dx = event.clientX - this.lastX;
        const dy = event.clientY - this.lastY;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.travel += Math.abs(dx) + Math.abs(dy);
        this.yawTarget += dx * 0.0032;
        this.pitchTarget = clamp(this.pitchTarget + dy * 0.0032, -1.5, 1.5);
        this.idle = 0;
        return;
      }
      const hit = this.pick(event.clientX, event.clientY);
      this.setHover(hit?.id ?? null);
    });

    const endDrag = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (this.travel < 8) {
        const hit = this.pick(event.clientX, event.clientY);
        if (hit) {
          this.focus(hit.id);
          this.handlers.onSelect?.(hit.id);
        }
      }
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", () => {
      if (!this.dragging) this.setHover(null);
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoom(event.deltaY * 0.045);
      },
      { passive: false },
    );

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.clearFocus();
  };

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  private readonly tick = () => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    if (this.dragging) this.idle = 0;
    else this.idle += dt;

    if (!this.selectedId && this.idle > 4) this.yawTarget += dt * 0.012;

    const k = 1 - Math.exp(-dt * (this.animating ? 2.8 : 9));
    this.yaw += (this.yawTarget - this.yaw) * k;
    this.pitch += (this.pitchTarget - this.pitch) * k;
    if (this.animating && Math.abs(this.yawTarget - this.yaw) < 0.003 && Math.abs(this.pitchTarget - this.pitch) < 0.003) {
      this.animating = false;
    }

    this.camera.fov += (this.fovTarget - this.camera.fov) * (1 - Math.exp(-dt * 2.8));
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateProjectionMatrix();

    for (const mesh of this.spinning) mesh.rotation.y = time * 0.12;

    if (this.reticle.visible) {
      const material = this.reticle.material as THREE.SpriteMaterial;
      material.opacity = 0.5 + Math.sin(time * 2.2) * 0.22;
      this.reticle.scale.setScalar(36 + Math.sin(time * 2.2) * 2.5);
      this.reticle.material.rotation = time * 0.12;
    }

    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
  };

  private project(ra: number, dec: number): { x: number; y: number; behind: boolean; centerDist: number } {
    const rect = this.canvas.getBoundingClientRect();
    this.vec.copy(dirFromRaDec(ra, dec, RADIUS * 0.98)).project(this.camera);
    const px = (this.vec.x * 0.5 + 0.5) * rect.width;
    const py = (-this.vec.y * 0.5 + 0.5) * rect.height;
    const centerDist = Math.hypot(px / rect.width - 0.5, py / rect.height - 0.5);
    return { x: px, y: py, behind: this.vec.z > 1, centerDist };
  }

  private updateLabels(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    for (const [id, label] of this.labels) {
      const node = this.nodes.get(id);
      if (!node || !node.visible) {
        label.style.opacity = "0";
        label.style.pointerEvents = "none";
        continue;
      }
      this.vec.copy(node.position).project(this.camera);
      const behind = this.vec.z > 1;
      const px = (this.vec.x * 0.5 + 0.5) * width;
      const py = (-this.vec.y * 0.5 + 0.5) * height;
      const offscreen = px < -80 || px > width + 80 || py < -40 || py > height + 40;

      if (behind || offscreen) {
        label.style.opacity = "0";
        label.style.pointerEvents = "none";
        continue;
      }
      const centerDist = Math.hypot(px / width - 0.5, py / height - 0.5);
      const fade = clamp(1.25 - centerDist * 1.5, 0.18, 1);
      label.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) translate(-50%, -50%)`;
      label.style.opacity = String(fade);
      label.style.pointerEvents = "auto";
      label.style.zIndex = String(Math.round(1000 - centerDist * 1000));
    }

    if (!this.showConstellations) return;
    for (const item of this.constellationLabels) {
      const { x, y, behind, centerDist } = this.project(item.ra, item.dec);
      if (behind) {
        item.el.style.opacity = "0";
        continue;
      }
      item.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
      item.el.style.opacity = String(clamp(1 - centerDist * 1.6, 0.08, 0.55));
    }
  }

  destroy(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.starMap.dispose();
    this.softEdge.dispose();
    this.renderer.dispose();
  }
}
