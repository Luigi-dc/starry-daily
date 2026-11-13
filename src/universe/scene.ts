import * as THREE from "three";
import { OBJECTS, type Kind } from "../data/objects";
import { SOLAR_BODIES, SOLAR_COMPUTED_AT, ORBITS, daysSinceEpoch, heliocentric, moonPosition, sunGeocentric, type Elements } from "../data/solar";
import { MINOR_BODIES, PROBES, moonBodies } from "../data/bodies";
import { COSMIC_OBJECTS, OBSERVABLE_UNIVERSE_LY, type CosmicObject } from "../data/galaxies";
import { NAMED_STARS } from "../data/stars";
import { REGIONS } from "../data/regions";
import starsJson from "../data/stars3d.json";
import { KIND_COLOR } from "../sky/colors";
import { LabelLayer, type LabelCandidate } from "./labels";
import { ARMS, armAngle, makeCloud, milkyWayModel, setPoint, type PointCloud } from "./galaxy";
import { cmbMaterial, glowPointsMaterial, milkyWayBackdropMaterial, starMaterial, starSurfaceMaterial } from "./shaders";
import {
  SPIRAL_EXTENT_LY,
  clusterTexture,
  dwarfTexture,
  ellipticalTexture,
  glowTexture,
  hasSurface,
  irregularTexture,
  nebulaTexture,
  saturnRingTexture,
  spiralTexture,
  surfaceTexture,
  voidTexture,
  wallTexture,
} from "./textures";
import {
  AU,
  GAL_X,
  GAL_Y,
  GAL_Z,
  GALACTIC_CENTER,
  KM,
  PC,
  add,
  cross,
  distanceLabel,
  fromEcliptic,
  fromEquatorial,
  fromGalactic,
  fromRaDec,
  gauss,
  hash01,
  len,
  lerp3,
  norm,
  parseLightYears,
  rng,
  scale,
  smoothstep,
  sub,
  v3,
  type V3,
} from "./units";

/* ------------------------------------------------------------------ */
/* entità                                                              */
/* ------------------------------------------------------------------ */

interface Entity {
  id: string;
  name: string;
  kind: Kind;
  color: string;
  pos: V3;
  /** Raggio fisico (anni luce) se l'oggetto ha un corpo da disegnare, altrimenti 0. */
  radius: number;
  /** Distanza della camera quando ci si vola sopra. */
  viewD: number;
  /** L'etichetta compare entro 50 × labelLy dalla camera e oltre minLy. */
  labelLy: number;
  minLy: number;
  priority: number;
  region: boolean;
  /** Dimensione del punto-marker in pixel (0 = nessun marker). */
  marker: number;
  absMag?: number;
  /** Oggetto 3D da posizionare a ogni fotogramma e sua dimensione (diametro in anni luce). */
  object?: THREE.Object3D;
  sizeLy?: number;
  /** Opacità di base del materiale dell'oggetto. */
  baseOpacity?: number;
  spin?: number;
  /** Vicino al quale si trova: per i satelliti, il pianeta. */
  parent?: string;
}

export interface UniverseScale {
  id: string;
  label: string;
  focus: string;
  distance: number;
  /** Da dove guardare (vettore dal fuoco alla camera); se assente si mantiene l'angolo attuale. */
  view?: V3;
}

export const SCALES: UniverseScale[] = [
  { id: "planets", label: "Pianeti", focus: "sun", distance: 9 * AU },
  { id: "solar", label: "Sistema solare", focus: "sun", distance: 110 * AU },
  { id: "oort", label: "Nube di Oort", focus: "sun", distance: 3.2 },
  { id: "stars", label: "Stelle vicine", focus: "sun", distance: 48 },
  { id: "galaxy", label: "Via Lattea", focus: "milky-way", distance: 165000, view: add(GAL_Z, scale(GAL_X, -0.7)) },
  { id: "local", label: "Gruppo Locale", focus: "local-group", distance: 6.5e6, view: add(GAL_Z, scale(GAL_Y, 0.9)) },
  { id: "cosmic", label: "Superammassi", focus: "sun", distance: 1.4e9 },
  { id: "universe", label: "Universo osservabile", focus: "sun", distance: 1.9e11 },
];

export interface UniverseInfo {
  level: string;
  scaleLabel: string;
  scalePx: number;
  /** Distanza della camera dal Sole, leggibile. */
  fromSun: string;
  focusName: string;
  scaleId: string;
}

const LEVELS: Array<[number, string, string]> = [
  [2e-6, "Vicino al corpo celeste", "planets"],
  [3e-4, "Pianeti interni", "planets"],
  [0.012, "Sistema solare", "solar"],
  [8, "Nube di Oort e dintorni", "oort"],
  [6000, "Stelle vicine", "stars"],
  [1.2e6, "Via Lattea", "galaxy"],
  [5e7, "Gruppo Locale", "local"],
  [8e9, "Superammassi e rete cosmica", "cosmic"],
  [Infinity, "Universo osservabile", "universe"],
];

/* ------------------------------------------------------------------ */
/* dati fisici                                                         */
/* ------------------------------------------------------------------ */

const R_SUN_KM = 696000;

const RADIUS_KM: Record<string, number> = {
  sun: R_SUN_KM,
  moon: 1737,
  mercury: 2440,
  venus: 6052,
  earth: 6371,
  mars: 3390,
  jupiter: 69911,
  saturn: 58232,
  uranus: 25362,
  neptune: 24622,
};

/** Polo nord di rotazione (RA in gradi, Dec in gradi), IAU. */
const POLES: Record<string, [number, number]> = {
  sun: [286.13, 63.87],
  mercury: [281.01, 61.41],
  venus: [272.76, 67.16],
  earth: [0, 90],
  moon: [270, 66.56],
  mars: [317.68, 52.89],
  jupiter: [268.06, 64.5],
  saturn: [40.59, 83.54],
  uranus: [257.31, -15.18],
  neptune: [299.36, 43.46],
  pluto: [132.99, -6.16],
  charon: [132.99, -6.16],
};
const ECLIPTIC_POLE: [number, number] = [270, 66.56];

const SPIN: Record<string, number> = {
  sun: 0.02,
  mercury: 0.01,
  venus: -0.005,
  earth: 0.12,
  mars: 0.12,
  jupiter: 0.3,
  saturn: 0.27,
  uranus: -0.17,
  neptune: 0.18,
};

/** Dimensioni (anni luce) e orientamento degli oggetti celebri del cielo profondo. */
const FAMOUS_3D: Record<string, { size: number; shape?: CosmicObject["shape"]; inc?: number; pa?: number }> = {
  orion: { size: 24 },
  pillars: { size: 70 },
  carina: { size: 230 },
  crab: { size: 11 },
  ring: { size: 1.3 },
  helix: { size: 2.9 },
  tarantula: { size: 600 },
  pleiades: { size: 17 },
  horsehead: { size: 7 },
  "cassiopeia-a": { size: 10 },
  "galactic-center": { size: 80 },
  andromeda: { size: 152000, shape: "spiral", inc: 77, pa: 38 },
  whirlpool: { size: 76000, shape: "spiral", inc: 20, pa: 163 },
  sombrero: { size: 50000, shape: "spiral", inc: 84, pa: 90 },
  "centaurus-a": { size: 60000, shape: "elliptical" },
  m83: { size: 55000, shape: "spiral", inc: 24, pa: 45 },
  antennae: { size: 100000, shape: "irregular" },
};

const ORIENTATION: Record<string, [number, number]> = {
  m33: [54, 23],
  lmc: [35, 170],
  smc: [60, 45],
  m81: [59, 157],
  m101: [16, 0],
  ngc1300: [50, 106],
};

/** Colore di una stella dall'indice B−V (temperatura di Ballesteros, poi corpo nero approssimato). */
function bvToRgb(bv: number): [number, number, number] {
  const b = Math.min(2, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const k = t / 100;
  let r: number;
  let g: number;
  let bl: number;
  if (k <= 66) {
    r = 255;
    g = 99.47 * Math.log(k) - 161.12;
    bl = k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(k - 60, -0.1332);
    g = 288.12 * Math.pow(k - 60, -0.0755);
    bl = 255;
  }
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  // un po' di saturazione in meno: a occhio le stelle sono quasi bianche
  const rgb: [number, number, number] = [c(r), c(g), c(bl)];
  const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
  return [mean + (rgb[0] - mean) * 0.75, mean + (rgb[1] - mean) * 0.75, mean + (rgb[2] - mean) * 0.75];
}

/** Raggio indicativo di una stella dal tipo spettrale (in raggi solari). */
function starRadius(spectral: string): number {
  const base: Record<string, number> = { O: 9, B: 4.5, A: 1.9, F: 1.35, G: 1, K: 0.8, M: 0.45, D: 0.012 };
  const r = base[spectral.charAt(0)] ?? 1;
  // classe di luminosità: I supergiganti, II giganti brillanti, III giganti, IV subgiganti, V nane
  const lum = spectral.replace(/^[A-Z][0-9.]*/, "").replace(/^[^IV]*/, "");
  if (lum.startsWith("III")) return r * 14;
  if (lum.startsWith("II")) return r * 40;
  if (lum.startsWith("IV")) return r * 2;
  if (lum.startsWith("I")) return r * 120;
  return r;
}

function poleVector(id: string): V3 {
  const [ra, dec] = POLES[id] ?? ECLIPTIC_POLE;
  return fromRaDec(ra / 15, dec, 1);
}

/** Posizione su un'orbita kepleriana a una data anomalia eccentrica (UA, eclittica). */
function orbitPoint(el: Elements, d: number, E: number): V3 {
  const DEG = Math.PI / 180;
  const node = (el[0] + el[1] * d) * DEG;
  const incl = (el[2] + el[3] * d) * DEG;
  const peri = (el[4] + el[5] * d) * DEG;
  const a = el[6] + el[7] * d;
  const e = el[8] + el[9] * d;
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const vw = v + peri;
  return {
    x: r * (Math.cos(node) * Math.cos(vw) - Math.sin(node) * Math.sin(vw) * Math.cos(incl)),
    y: r * (Math.sin(node) * Math.cos(vw) + Math.cos(node) * Math.sin(vw) * Math.cos(incl)),
    z: r * Math.sin(vw) * Math.sin(incl),
  };
}

/** Posizione kepleriana di oggi (UA, eclittica). */
function keplerPosition(el: Elements, d: number): V3 {
  const p = heliocentric(el, d);
  return { x: p.x, y: p.y, z: p.z };
}

/* ------------------------------------------------------------------ */
/* vista                                                               */
/* ------------------------------------------------------------------ */

const FOV = 50;
const MAX_D = 3.5e11;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Flight {
  from: V3;
  to: V3;
  /** Angoli di partenza e arrivo della camera (se il volo cambia anche il punto di vista). */
  angles?: { theta0: number; phi0: number; theta1: number; phi1: number };
  logFrom: number;
  logTo: number;
  peak: number;
  dist: number;
  start: number;
  duration: number;
}

interface FadeLine {
  line: THREE.Line;
  /** Raggio tipico (anni luce) che regola quando la linea si vede. */
  size: number;
  base: number;
  /** Centro attorno a cui è disegnata (per le orbite delle lune). */
  parent?: string;
}

export class UniverseView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 1e-6, 1e15);
  private readonly backScene = new THREE.Scene();
  private readonly backCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  private readonly labels: LabelLayer;
  private readonly entities: Entity[] = [];
  /** Sfera condivisa da tutti i corpi: abbastanza segmenti da non vedere spigoli neanche da vicino. */
  private readonly sphere = new THREE.SphereGeometry(1, 192, 128);
  private readonly byId = new Map<string, Entity>();

  // gruppi con unità propria (riscalati a ogni fotogramma)
  private readonly solarGroup = new THREE.Group(); // unità: UA, origine: Sole
  private readonly starGroup = new THREE.Group(); // unità: anno luce, origine: Sole
  private readonly galaxyGroup = new THREE.Group(); // unità: anno luce, origine: centro galattico, assi galattici
  private readonly cosmicGroup = new THREE.Group(); // unità: anno luce, origine: Sole

  private starMat!: THREE.ShaderMaterial;
  private backdrop!: THREE.ShaderMaterial;
  private milkyWayPoints!: THREE.ShaderMaterial;
  private milkyWayGlow!: THREE.MeshBasicMaterial;
  private asteroidMat!: THREE.ShaderMaterial;
  private kuiperMat!: THREE.ShaderMaterial;
  private oortMat!: THREE.ShaderMaterial;
  private webNearMat!: THREE.ShaderMaterial;
  private webFarMat!: THREE.ShaderMaterial;
  private cmb!: THREE.Mesh;
  private cmbMat!: THREE.ShaderMaterial;
  private sunLight = new THREE.PointLight(0xfff4e6, 2.8, 0, 0);
  private orbits: FadeLine[] = [];
  private moonOrbits: FadeLine[] = [];

  private markerGeometry!: THREE.BufferGeometry;
  private markerEntities: Entity[] = [];
  private markerMat!: THREE.ShaderMaterial;

  private focusStar!: THREE.Group;
  private focusStarMat!: THREE.ShaderMaterial;
  private focusStarGlow!: THREE.SpriteMaterial;
  private sunMat!: THREE.ShaderMaterial;
  private starData: number[][] = [];

  // stato della camera: fuoco (anni luce), distanza D (anni luce), angoli
  private focusPos: V3 = v3();
  private focusId = "sun";
  private logD = Math.log(110 * AU);
  private targetLogD = this.logD;
  private theta = 0.6;
  private phi = 0.42;
  private velTheta = 0;
  private velPhi = 0;
  private flight: Flight | null = null;

  private width = 1;
  private height = 1;
  private running = false;
  private frame = 0;
  private lastTime = 0;
  private lastInfoKey = "";
  private screen: Array<{ id: string; x: number; y: number }> = [];

  onSelect: (id: string) => void = () => {};
  onView: (info: UniverseInfo) => void = () => {};

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x010208, 1);
    this.renderer.autoClear = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = "u-canvas";
    host.append(this.renderer.domElement);
    this.labels = new LabelLayer(host, (id) => this.pick(id));

    this.scene.add(this.solarGroup, this.starGroup, this.galaxyGroup, this.cosmicGroup);
    this.scene.add(this.sunLight, new THREE.AmbientLight(0x6070a0, 0.14));
    this.galaxyGroup.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(GAL_X.x, GAL_X.y, GAL_X.z),
        new THREE.Vector3(GAL_Y.x, GAL_Y.y, GAL_Y.z),
        new THREE.Vector3(GAL_Z.x, GAL_Z.y, GAL_Z.z),
      ),
    );

    this.buildBackdrop();
    this.buildSolarSystem();
    this.buildStars();
    this.buildMilkyWay();
    this.buildDeepSky();
    this.buildCosmicWeb();
    this.buildRegions();
    this.buildMarkers();
    this.bindControls();

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(host);
    this.resize();
  }

  /* ---------------- costruzione ---------------- */

  private addEntity(entity: Entity): Entity {
    this.entities.push(entity);
    this.byId.set(entity.id, entity);
    return entity;
  }

  private buildBackdrop(): void {
    this.backdrop = milkyWayBackdropMaterial(
      new THREE.Vector3(GAL_X.x, GAL_X.y, GAL_X.z),
      new THREE.Vector3(GAL_Y.x, GAL_Y.y, GAL_Y.z),
      new THREE.Vector3(GAL_Z.x, GAL_Z.y, GAL_Z.z),
    );
    this.backScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), this.backdrop));
  }

  private sphereBody(id: string, radiusLy: number, color: string): THREE.Group {
    const group = new THREE.Group();
    const material =
      id === "sun"
        ? (this.sunMat = starSurfaceMaterial(new THREE.Color("#ffcf7a"), surfaceTexture("sun")))
        : new THREE.MeshStandardMaterial({
            // la mappa NASA si carica la prima volta che il corpo diventa visibile (vedi update)
            color: hasSurface(id) ? 0xffffff : new THREE.Color(color),
            roughness: 0.92,
            metalness: 0.02,
          });
    const mesh = new THREE.Mesh(this.sphere, material);
    mesh.name = "body";
    group.add(mesh);

    if (id === "saturn") {
      const inner = 1.24;
      const outer = 2.27;
      const ringGeometry = new THREE.RingGeometry(inner, outer, 160, 1);
      const positions = ringGeometry.attributes.position;
      const uvs = ringGeometry.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        const r = Math.hypot(positions.getX(i), positions.getY(i));
        uvs.setXY(i, (r - inner) / (outer - inner), 0.5);
      }
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshStandardMaterial({
          map: saturnRingTexture(),
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 1,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    }
    if (id === "sun") {
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc670, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }),
      );
      glow.scale.set(9, 9, 1);
      group.add(glow);
    }

    // asse di rotazione: l'asse y della sfera punta verso il polo del corpo
    const pole = poleVector(id);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(pole.x, pole.y, pole.z));
    group.userData.radius = radiusLy;
    group.userData.textureId = id !== "sun" && hasSurface(id) ? id : null;
    this.scene.add(group);
    return group;
  }

  private orbitLine(points: V3[], color: string, opacity: number, closed: boolean): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    const array = new Float32Array(points.length * 3);
    points.forEach((p, i) => array.set([p.x, p.y, p.z], i * 3));
    geometry.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    return closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
  }

  private buildSolarSystem(): void {
    const d = daysSinceEpoch(SOLAR_COMPUTED_AT);
    const sunGeo = sunGeocentric(d);
    const earthEcl = v3(-sunGeo.x, -sunGeo.y, -sunGeo.z);
    const earthPos = fromEcliptic(earthEcl.x, earthEcl.y, earthEcl.z, AU);

    // Sole
    const sunRadius = R_SUN_KM * KM;
    this.addEntity({
      id: "sun", name: "Sole", kind: "sun", color: KIND_COLOR.sun, pos: v3(), radius: sunRadius, viewD: sunRadius * 9,
      labelLy: 0.03, minLy: 0, priority: 0, region: false, marker: 0,
      object: this.sphereBody("sun", sunRadius, KIND_COLOR.sun), spin: SPIN.sun,
    });

    // pianeti (con la Terra) e Luna
    const earthElements: Elements = [0, 0, 0, 0, 282.9404 + 180, 4.70935e-5, 1, 0, 0.016709, -1.151e-9, 356.047, 0.9856002585];
    for (const body of SOLAR_BODIES) {
      if (body.kind !== "planet") continue;
      const el = body.id === "earth" ? earthElements : ORBITS[body.id];
      if (!el) continue;
      const ecl = body.id === "earth" ? earthEcl : keplerPosition(el, d);
      const pos = body.id === "earth" ? earthPos : fromEcliptic(ecl.x, ecl.y, ecl.z, AU);
      const radius = RADIUS_KM[body.id] * KM;
      const a = el[6];
      this.addEntity({
        id: body.id, name: body.name, kind: "planet", color: body.tint[0], pos, radius,
        viewD: radius * (body.id === "saturn" ? 9 : 5), labelLy: (a * 0.5 + 0.12) * AU, minLy: 0, priority: 2, region: false, marker: 5,
        object: this.sphereBody(body.id, radius, body.tint[0]), spin: SPIN[body.id] ?? 0.1,
      });
      this.addOrbit(el, d, body.tint[0], a, 0.5);
    }

    const moon = moonPosition(d);
    const moonPos = add(earthPos, fromEcliptic(moon.x, moon.y, moon.z, 6378.14 * KM));
    const moonRadius = RADIUS_KM.moon * KM;
    this.addEntity({
      id: "moon", name: "Luna", kind: "moon", color: KIND_COLOR.moon, pos: moonPos, radius: moonRadius, viewD: moonRadius * 5,
      labelLy: 384400 * KM * 0.5, minLy: 0, priority: 5, region: false, marker: 3, parent: "earth",
      object: this.sphereBody("moon", moonRadius, "#d8dbe2"), spin: 0.02,
    });
    this.addMoonOrbit("earth", 384400 * KM, ECLIPTIC_POLE);

    // corpi minori
    for (const body of MINOR_BODIES) {
      const pos = fromEcliptic(body.helio.x, body.helio.y, body.helio.z, AU);
      const radius = body.radiusKm * KM;
      const isComet = body.kind === "comet";
      this.addEntity({
        id: body.id, name: body.name, kind: body.kind, color: body.color, pos, radius,
        viewD: radius * (isComet ? 12 : 6), labelLy: body.elements[6] * AU * (isComet ? 0.2 : 0.3), minLy: 0,
        priority: body.kind === "dwarf" ? 4 : 6, region: false, marker: body.kind === "dwarf" ? 4 : 3,
        object: this.sphereBody(isComet ? "comet" : body.id, radius, body.color), spin: 0.15,
      });
      this.addOrbit(body.elements, d, isComet ? "#5fd6c6" : "#b9a88e", body.elements[6], isComet ? 0.32 : 0.28);
    }

    // satelliti dei pianeti
    for (const moonBody of moonBodies(new Map())) {
      const parent = this.byId.get(moonBody.parent);
      if (!parent) continue;
      const pole = poleVector(moonBody.parent);
      const [u, w] = this.planeBasis(pole);
      const angle = 2 * Math.PI * (d / moonBody.periodDays + hash01(moonBody.id));
      const offset = add(scale(u, Math.cos(angle) * moonBody.aKm * KM), scale(w, Math.sin(angle) * moonBody.aKm * KM));
      const radius = moonBody.radiusKm * KM;
      this.addEntity({
        id: moonBody.id, name: moonBody.name, kind: "moon", color: moonBody.color, pos: add(parent.pos, offset), radius,
        viewD: radius * 5, labelLy: moonBody.aKm * KM * 0.5, minLy: 0, priority: 5, region: false, marker: 3,
        parent: moonBody.parent, object: this.sphereBody(moonBody.id, radius, moonBody.color), spin: 0.05,
      });
      this.addMoonOrbit(moonBody.parent, moonBody.aKm * KM, POLES[moonBody.parent] ?? ECLIPTIC_POLE);
    }

    // sonde
    for (const probe of PROBES) {
      this.addEntity({
        id: probe.id, name: probe.name, kind: "probe", color: KIND_COLOR.probe, pos: fromRaDec(probe.ra, probe.dec, probe.au * AU),
        radius: 0, viewD: 3 * AU, labelLy: 60 * AU, minLy: 0, priority: 6, region: false, marker: 3.5,
      });
    }

    this.buildBelts(d);
  }

  private planeBasis(pole: V3): [V3, V3] {
    const helper = Math.abs(pole.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
    const u = norm(cross(helper, pole));
    const w = cross(pole, u);
    return [u, w];
  }

  private addOrbit(el: Elements, d: number, color: string, aAU: number, opacity: number): void {
    const segments = el[8] > 0.5 ? 720 : 360;
    const points: V3[] = [];
    for (let i = 0; i < segments; i++) {
      const p = orbitPoint(el, d, (i / segments) * Math.PI * 2);
      points.push(fromEcliptic(p.x, p.y, p.z, 1));
    }
    const line = this.orbitLine(points, color, opacity, true);
    this.solarGroup.add(line);
    this.orbits.push({ line, size: aAU * AU, base: opacity });
  }

  private addMoonOrbit(parent: string, radiusLy: number, pole: [number, number]): void {
    const points: V3[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      points.push(v3(Math.cos(a), 0, Math.sin(a)));
    }
    const line = this.orbitLine(points, "#9fb4ff", 0.35, true);
    const p = fromRaDec(pole[0] / 15, pole[1], 1);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.x, p.y, p.z));
    line.userData.radius = radiusLy;
    this.scene.add(line);
    this.moonOrbits.push({ line, size: radiusLy, base: 0.35, parent });
  }

  private pointsObject(cloud: PointCloud, material: THREE.ShaderMaterial): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(cloud.colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(cloud.sizes, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(cloud.alphas, 1));
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private buildBelts(d: number): void {
    const rand = rng(5);
    // fascia principale (UA, eclittica), con i Troiani di Giove nei punti L4 e L5
    const jupiter = keplerPosition(ORBITS.jupiter, d);
    const jupiterLon = Math.atan2(jupiter.y, jupiter.x);
    const belt = makeCloud(9000);
    for (let i = 0; i < belt.count; i++) {
      let r: number;
      let lon: number;
      if (i < 1200) {
        r = 5.2 + gauss(rand) * 0.15;
        lon = jupiterLon + (i % 2 ? 1 : -1) * (Math.PI / 3) + gauss(rand) * 0.22;
      } else {
        r = 2.1 + Math.pow(rand(), 0.9) * 1.2;
        // lacune di Kirkwood: risonanze 3:1, 5:2 e 2:1 con Giove
        if (Math.abs(r - 2.5) < 0.03 || Math.abs(r - 2.82) < 0.025 || Math.abs(r - 3.27) < 0.03) r += 0.06;
        lon = rand() * Math.PI * 2;
      }
      const z = gauss(rand) * r * 0.08;
      const p = fromEcliptic(r * Math.cos(lon), r * Math.sin(lon), z, 1);
      const shade = 0.6 + rand() * 0.4;
      setPoint(belt, i, p.x, p.y, p.z, [0.85 * shade, 0.78 * shade, 0.66 * shade], 1.2 + rand(), 0.3);
    }
    this.asteroidMat = glowPointsMaterial();
    this.solarGroup.add(this.pointsObject(belt, this.asteroidMat));

    const kuiper = makeCloud(11000);
    for (let i = 0; i < kuiper.count; i++) {
      const r = rand() < 0.25 ? 39.4 + gauss(rand) * 0.6 : 30 + rand() * 20 + Math.abs(gauss(rand)) * 4;
      const lon = rand() * Math.PI * 2;
      const z = gauss(rand) * r * 0.14;
      const p = fromEcliptic(r * Math.cos(lon), r * Math.sin(lon), z, 1);
      setPoint(kuiper, i, p.x, p.y, p.z, [0.62, 0.72, 0.9], 1.2 + rand(), 0.32);
    }
    this.kuiperMat = glowPointsMaterial();
    this.solarGroup.add(this.pointsObject(kuiper, this.kuiperMat));

    const oort = makeCloud(9000);
    for (let i = 0; i < oort.count; i++) {
      const r = Math.exp(Math.log(2000) + rand() * (Math.log(100000) - Math.log(2000)));
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      // la nube interna (di Hills) è più schiacciata sul piano dei pianeti
      const flatten = r < 20000 ? 0.5 : 1;
      const p = fromEcliptic(r * s * Math.cos(t), r * s * Math.sin(t), r * u * flatten, 1);
      setPoint(oort, i, p.x, p.y, p.z, [0.6, 0.78, 1], 1.4, 0.4);
    }
    this.oortMat = glowPointsMaterial();
    this.solarGroup.add(this.pointsObject(oort, this.oortMat));
  }

  private buildStars(): void {
    const stars = (starsJson as { stars: number[][] }).stars;
    this.starData = stars;
    const count = stars.length + 1;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const mags = new Float32Array(count);
    // il Sole, visto da lontano, è una stella come le altre
    colors.set(bvToRgb(0.656), 0);
    mags[0] = 4.83;
    stars.forEach(([x, y, z, absmag, ci], i) => {
      const p = fromEquatorial(x * PC, y * PC, z * PC);
      positions.set([p.x, p.y, p.z], (i + 1) * 3);
      colors.set(bvToRgb(ci), (i + 1) * 3);
      mags[i + 1] = absmag;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aMag", new THREE.BufferAttribute(mags, 1));
    this.starMat = starMaterial();
    const points = new THREE.Points(geometry, this.starMat);
    points.frustumCulled = false;
    this.starGroup.add(points);

    for (const star of NAMED_STARS) {
      const row = stars[star.index];
      if (!row) continue;
      const pos = fromEquatorial(row[0] * PC, row[1] * PC, row[2] * PC);
      const radius = starRadius(star.spectral) * R_SUN_KM * KM;
      this.addEntity({
        id: star.id, name: star.name, kind: "star", color: `#${new THREE.Color(...bvToRgb(row[4])).getHexString()}`, pos, radius,
        viewD: radius * 9, labelLy: 0.25, minLy: 0, priority: 3, region: false, marker: 0, absMag: row[3],
      });
    }

    // stella vista da vicino: una sola, riusata per quella su cui si vola
    this.focusStar = new THREE.Group();
    this.focusStarMat = starSurfaceMaterial(new THREE.Color(1, 1, 1), null);
    this.focusStar.add(new THREE.Mesh(this.sphere, this.focusStarMat));
    this.focusStarGlow = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glow = new THREE.Sprite(this.focusStarGlow);
    glow.scale.set(9, 9, 1);
    this.focusStar.add(glow);
    this.focusStar.visible = false;
    this.scene.add(this.focusStar);
  }

  private buildMilkyWay(): void {
    this.milkyWayPoints = glowPointsMaterial();
    this.galaxyGroup.add(this.pointsObject(milkyWayModel(), this.milkyWayPoints));
    this.milkyWayGlow = new THREE.MeshBasicMaterial({
      map: spiralTexture(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.galaxyGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(SPIRAL_EXTENT_LY, SPIRAL_EXTENT_LY), this.milkyWayGlow));

    ARMS.forEach((arm, i) => {
      const r = 38000 + i * 1500;
      const t = armAngle(arm.phase, r);
      this.addEntity({
        id: `arm-${i}`, name: arm.name, kind: "structure", color: "#9db8ff", pos: fromGalactic(r * Math.cos(t), r * Math.sin(t), 0),
        radius: 0, viewD: 60000, labelLy: 5000, minLy: 25000, priority: 7, region: true, marker: 0,
      });
    });
  }

  private galaxyObject(id: string, shape: CosmicObject["shape"], pos: V3, raH: number, decDeg: number, sizeLy: number, inc?: number, pa?: number): THREE.Object3D {
    if (shape === "spiral") {
      const material = new THREE.MeshBasicMaterial({
        map: spiralTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.95,
      });
      // la texture copre SPIRAL_EXTENT_LY per un disco di ~100.000 anni luce
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(SPIRAL_EXTENT_LY / 100000, SPIRAL_EXTENT_LY / 100000), material);
      const holder = new THREE.Group();
      holder.add(plane);
      const ra = raH * 15 * (Math.PI / 180);
      const dec = decDeg * (Math.PI / 180);
      const er = norm(pos);
      const east = v3(-Math.sin(ra), 0, -Math.cos(ra));
      const north = v3(-Math.sin(dec) * Math.cos(ra), Math.cos(dec), Math.sin(dec) * Math.sin(ra));
      const i = ((inc ?? 20 + hash01(id) * 60) * Math.PI) / 180;
      const p = ((pa ?? hash01(`${id}-pa`) * 180) * Math.PI) / 180;
      const major = add(scale(north, Math.cos(p)), scale(east, Math.sin(p)));
      const minor = add(scale(north, -Math.sin(p)), scale(east, Math.cos(p)));
      const normal = norm(add(scale(er, Math.cos(i)), scale(minor, Math.sin(i))));
      const other = cross(normal, major);
      holder.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3(major.x, major.y, major.z),
          new THREE.Vector3(other.x, other.y, other.z),
          new THREE.Vector3(normal.x, normal.y, normal.z),
        ),
      );
      holder.rotateZ(hash01(`${id}-spin`) * Math.PI * 2);
      holder.userData.material = material;
      this.scene.add(holder);
      return holder;
    }
    const texture =
      shape === "elliptical" ? ellipticalTexture()
      : shape === "irregular" ? irregularTexture()
      : shape === "cluster" ? clusterTexture()
      : shape === "wall" ? wallTexture()
      : shape === "void" ? voidTexture()
      : dwarfTexture();
    const material = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      opacity: shape === "wall" ? 0.4 : shape === "cluster" || shape === "void" ? 0.6 : shape === "dwarf" ? 0.5 : shape === "irregular" ? 0.7 : 0.9,
      rotation: hash01(`${id}-rot`) * Math.PI * 2,
    });
    const sprite = new THREE.Sprite(material);
    sprite.userData.material = material;
    this.scene.add(sprite);
    return sprite;
  }

  private buildDeepSky(): void {
    // oggetti celebri con una distanza nota
    for (const o of OBJECTS) {
      const info = FAMOUS_3D[o.id];
      const ly = parseLightYears(o.distance);
      if (!info || !ly) continue;
      const pos = o.id === "galactic-center" ? GALACTIC_CENTER : fromRaDec(o.ra, o.dec, ly);
      const isGalaxy = o.kind === "galaxy";
      let object: THREE.Object3D;
      if (info.shape) {
        object = this.galaxyObject(o.id, info.shape, pos, o.ra, o.dec, info.size, info.inc, info.pa);
      } else {
        const material = new THREE.SpriteMaterial({
          map: o.id === "galactic-center" ? glowTexture() : nebulaTexture(KIND_COLOR[o.kind]),
          color: o.id === "galactic-center" ? 0xffd9a8 : 0xffffff,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
        });
        object = new THREE.Sprite(material);
        object.userData.material = material;
        this.scene.add(object);
      }
      this.addEntity({
        id: o.id, name: o.id === "galactic-center" ? "Sagittarius A*" : o.name, kind: o.kind, color: KIND_COLOR[o.kind], pos,
        radius: 0, sizeLy: info.size, viewD: info.size * (isGalaxy ? 1.4 : 2.4),
        labelLy: isGalaxy ? Math.max(info.size * 3, 4e5) : Math.max(info.size * 4, 200), minLy: 0,
        priority: isGalaxy ? 2 : 4, region: false, marker: isGalaxy ? 4 : 3, object, baseOpacity: 0.9,
      });
    }

    // Gruppo Locale, galassie vicine e grandi strutture
    for (const o of COSMIC_OBJECTS) {
      const pos = fromRaDec(o.ra, o.dec, o.ly);
      const [inc, pa] = ORIENTATION[o.id] ?? [undefined, undefined];
      const object = this.galaxyObject(o.id, o.shape, pos, o.ra, o.dec, o.sizeLy, inc, pa);
      const structure = o.kind === "structure";
      this.addEntity({
        id: o.id, name: o.name, kind: o.kind, color: KIND_COLOR[o.kind], pos, radius: 0, sizeLy: o.sizeLy,
        viewD: o.sizeLy * (structure ? 1.6 : 1.5),
        labelLy: structure ? o.sizeLy * 1.2 : o.group === "local" ? Math.max(o.sizeLy * 4, 1.4e5) : Math.max(o.sizeLy * 8, 1.5e6),
        minLy: structure ? o.sizeLy * 0.7 : 0,
        priority: structure ? 3 : o.group === "local" ? 3 : 4, region: structure, marker: structure ? 0 : 3,
        object, baseOpacity: (object.userData.material as THREE.Material).opacity,
      });
    }
  }

  private buildCosmicWeb(): void {
    const web = (nodes: number, radius: number, perEdge: number, seed: number): PointCloud => {
      const rand = rng(seed);
      const centers: V3[] = [];
      for (let i = 0; i < nodes; i++) {
        const r = radius * Math.cbrt(rand());
        const u = rand() * 2 - 1;
        const t = rand() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        centers.push(v3(r * s * Math.cos(t), r * u, r * s * Math.sin(t)));
      }
      const edges: Array<[number, number]> = [];
      centers.forEach((c, i) => {
        const nearest = centers
          .map((o, j) => ({ j, dist: len(sub(o, c)) }))
          .filter((n) => n.j !== i)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);
        for (const n of nearest) if (i < n.j) edges.push([i, n.j]);
      });
      const cloud = makeCloud(edges.length * perEdge + nodes * 40);
      let k = 0;
      const purple: [number, number, number] = [0.62, 0.55, 1];
      const gold: [number, number, number] = [1, 0.8, 0.6];
      for (const [a, b] of edges) {
        const length = len(sub(centers[b], centers[a]));
        for (let i = 0; i < perEdge; i++) {
          const t = rand();
          const p = lerp3(centers[a], centers[b], t);
          const spread = length * 0.035;
          setPoint(cloud, k++, p.x + gauss(rand) * spread, p.y + gauss(rand) * spread, p.z + gauss(rand) * spread, rand() < 0.75 ? purple : gold, 1.2 + rand(), 0.35);
        }
      }
      for (const c of centers) {
        for (let i = 0; i < 40; i++) {
          const spread = radius * 0.012;
          setPoint(cloud, k++, c.x + gauss(rand) * spread, c.y + gauss(rand) * spread, c.z + gauss(rand) * spread, gold, 1.6 + rand(), 0.6);
        }
      }
      return cloud;
    };
    this.webNearMat = glowPointsMaterial();
    this.webFarMat = glowPointsMaterial();
    this.cosmicGroup.add(this.pointsObject(web(420, 2.2e9, 70, 77), this.webNearMat));
    this.cosmicGroup.add(this.pointsObject(web(520, 42e9, 60, 99), this.webFarMat));

    this.cmbMat = cmbMaterial();
    this.cmb = new THREE.Mesh(new THREE.SphereGeometry(OBSERVABLE_UNIVERSE_LY, 96, 64), this.cmbMat);
    this.cmb.frustumCulled = false;
    this.cosmicGroup.add(this.cmb);
  }

  private buildRegions(): void {
    for (const region of REGIONS) {
      const pos = region.id === "milky-way" ? GALACTIC_CENTER : fromRaDec(region.ra, region.dec, region.ly);
      this.addEntity({
        id: region.id, name: region.name, kind: "structure", color: KIND_COLOR.structure, pos, radius: 0, viewD: region.viewLy,
        labelLy: region.labelLy, minLy: region.minLy, priority: 1, region: true, marker: region.id === "milky-way" ? 4 : 0,
        sizeLy: region.id === "milky-way" ? 100000 : undefined,
      });
    }
    // «sei qui» quando il sistema solare è troppo piccolo per vedersi
    this.addEntity({
      id: "solar-system", name: "Sistema solare · sei qui", kind: "sun", color: KIND_COLOR.sun, pos: v3(), radius: 0, viewD: 110 * AU,
      labelLy: 2e5, minLy: 1.5, priority: 1, region: true, marker: 0,
    });
  }

  private buildMarkers(): void {
    this.markerEntities = this.entities.filter((e) => e.marker > 0);
    const count = this.markerEntities.length;
    const cloud = makeCloud(count);
    this.markerEntities.forEach((e, i) => {
      const c = new THREE.Color(e.color);
      setPoint(cloud, i, 0, 0, 0, [c.r, c.g, c.b], e.marker, 0);
    });
    this.markerMat = glowPointsMaterial();
    const points = this.pointsObject(cloud, this.markerMat);
    (points.geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    (points.geometry.attributes.aAlpha as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    points.renderOrder = 5;
    this.markerGeometry = points.geometry;
    this.scene.add(points);
  }

  /* ---------------- controlli ---------------- */

  private bindControls(): void {
    const canvas = this.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;

    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moved = 0;
      this.velTheta = this.velPhi = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      const prev = pointers.get(event.pointerId);
      if (!prev) return;
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 1) {
        this.cancelFlight();
        this.velTheta = -dx * 0.0055;
        this.velPhi = dy * 0.0055;
        this.rotate(this.velTheta, this.velPhi);
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoomBy(Math.log(pinch / dist) * 1.6);
        pinch = dist;
      }
    });
    const release = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (moved < 6 && event.type === "pointerup") this.clickAt(event);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        this.zoomBy(Math.max(-1.2, Math.min(1.2, delta * 0.0022)));
      },
      { passive: false },
    );
    canvas.addEventListener("dblclick", () => this.zoomBy(-1.1));
  }

  private rotate(dTheta: number, dPhi: number): void {
    this.theta += dTheta;
    this.phi = Math.max(-1.52, Math.min(1.52, this.phi + dPhi));
  }

  private minD(): number {
    const e = this.byId.get(this.focusId);
    if (e?.radius) return e.radius * 1.3;
    return 2e-9;
  }

  private zoomBy(logDelta: number): void {
    this.cancelFlight();
    this.targetLogD = Math.max(Math.log(this.minD()), Math.min(Math.log(MAX_D), this.targetLogD + logDelta));
  }

  zoomIn(): void {
    this.zoomBy(-0.9);
  }

  zoomOut(): void {
    this.zoomBy(0.9);
  }

  private cancelFlight(): void {
    if (!this.flight) return;
    this.flight = null;
    this.targetLogD = this.logD;
  }

  private clickAt(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: string | null = null;
    let bestDist = 18;
    for (const s of this.screen) {
      const dist = Math.hypot(s.x - x, s.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = s.id;
      }
    }
    if (best) this.pick(best);
  }

  private pick(id: string): void {
    const target = id === "solar-system" ? "sun" : id;
    this.focus(target);
    this.onSelect(target);
  }

  /* ---------------- API ---------------- */

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Vola sull'oggetto; restituisce false se nello spazio 3D non c'è. */
  focus(id: string, instant = false): boolean {
    const target = this.byId.get(id === "solar-system" ? "sun" : id);
    if (!target) return false;
    this.focusId = target.id;
    this.flyTo(target.pos, target.viewD, instant);
    return true;
  }

  goToScale(id: string): void {
    const s = SCALES.find((entry) => entry.id === id);
    if (!s) return;
    const target = this.byId.get(s.focus);
    if (!target) return;
    this.focusId = target.id;
    this.flyTo(target.pos, s.distance, false, s.view);
  }

  private flyTo(to: V3, distance: number, instant: boolean, view?: V3): void {
    const logTo = Math.log(Math.max(distance, this.minD()));
    if (instant) {
      this.flight = null;
      this.focusPos = to;
      this.logD = this.targetLogD = logTo;
      return;
    }
    const dist = len(sub(to, this.focusPos));
    const peak = Math.max(this.logD, logTo, Math.log(Math.max(dist, 1e-12) * 1.4));
    const span = Math.abs(peak - this.logD) + Math.abs(peak - logTo);
    let angles: Flight["angles"];
    if (view) {
      const dir = norm(view);
      const theta1 = Math.atan2(dir.x, dir.z);
      let delta = theta1 - this.theta;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      angles = { theta0: this.theta, phi0: this.phi, theta1: this.theta + delta, phi1: Math.asin(Math.max(-0.99, Math.min(0.99, dir.y))) };
    }
    this.flight = {
      from: this.focusPos,
      to,
      angles,
      logFrom: this.logD,
      logTo,
      peak,
      dist,
      start: performance.now(),
      duration: Math.min(5200, Math.max(1400, 900 + span * 140)),
    };
  }

  show(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  hide(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.labels.clear();
  }

  /* ---------------- fotogramma ---------------- */

  private resize(): void {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.backCamera.aspect = this.camera.aspect;
    this.backCamera.updateProjectionMatrix();
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(now, dt);
    this.renderer.clear();
    this.renderer.render(this.backScene, this.backCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  };

  private update(now: number, dt: number): void {
    // volo
    if (this.flight) {
      const f = this.flight;
      const t = Math.min(1, (now - f.start) / f.duration);
      const e = easeInOut(t);
      const base = f.logFrom + (f.logTo - f.logFrom) * e;
      // a metà volo ci si allontana abbastanza da vedere partenza e arrivo insieme
      const lift = f.peak - (f.logFrom + f.logTo) / 2;
      this.logD = f.peak > Math.max(f.logFrom, f.logTo) ? base + lift * Math.sin(Math.PI * e) : base;
      const D = Math.exp(this.logD);
      // lo spostamento resta proporzionato alla distanza: il bersaglio non «scappa» a fine volo
      const k = f.dist > 0 ? (0.5 * D) / f.dist : 1;
      const s = e < 0.5 ? Math.min(e, k) : Math.max(e, 1 - k);
      this.focusPos = lerp3(f.from, f.to, Math.min(1, Math.max(0, s)));
      if (f.angles) {
        this.theta = f.angles.theta0 + (f.angles.theta1 - f.angles.theta0) * e;
        this.phi = f.angles.phi0 + (f.angles.phi1 - f.angles.phi0) * e;
      }
      if (t >= 1) {
        this.flight = null;
        this.focusPos = f.to;
        this.logD = f.logTo;
      }
      this.targetLogD = this.logD;
    } else {
      this.logD += (this.targetLogD - this.logD) * Math.min(1, dt * 7);
      if (Math.abs(this.velTheta) + Math.abs(this.velPhi) > 1e-5) {
        this.velTheta *= Math.pow(0.04, dt);
        this.velPhi *= Math.pow(0.04, dt);
        this.rotate(this.velTheta * dt * 30, this.velPhi * dt * 30);
      }
    }

    const D = Math.exp(this.logD);
    const F = this.focusPos;
    const dir = v3(Math.cos(this.phi) * Math.sin(this.theta), Math.sin(this.phi), Math.cos(this.phi) * Math.cos(this.theta));
    // camera a distanza 1 (unità di scena = D anni luce) dal fuoco, nell'origine
    this.camera.position.set(dir.x, dir.y, dir.z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = 1e-6;
    this.camera.far = 1e15;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.backCamera.quaternion.copy(this.camera.quaternion);

    const cam = add(F, scale(dir, D)); // posizione della camera in anni luce
    const fromSun = len(cam);
    const inv = 1 / D;
    const projScale = this.height / (2 * Math.tan((FOV * Math.PI) / 360));
    const pixelRatio = this.renderer.getPixelRatio();
    const place = (object: THREE.Object3D, origin: V3, unit: number) => {
      object.position.set((origin.x - F.x) * inv, (origin.y - F.y) * inv, (origin.z - F.z) * inv);
      object.scale.setScalar(unit * inv);
    };

    // gruppi a scala propria
    place(this.solarGroup, v3(), AU);
    place(this.starGroup, v3(), 1);
    place(this.galaxyGroup, GALACTIC_CENTER, 1);
    place(this.cosmicGroup, v3(), 1);
    this.sunLight.position.set(-F.x * inv, -F.y * inv, -F.z * inv);

    // opacità dei livelli
    const insideGalaxy = 1 - smoothstep(500, 6000, fromSun);
    this.backdrop.uniforms.uOpacity.value = insideGalaxy;
    this.starMat.uniforms.uCam.value.set(cam.x, cam.y, cam.z);
    this.starMat.uniforms.uLimit.value = 6.6 + 2.5 * Math.log10(Math.max(1, D / 25));
    this.starMat.uniforms.uOpacity.value = 1 - smoothstep(9000, 45000, fromSun);
    this.starGroup.visible = this.starMat.uniforms.uOpacity.value > 0.001;
    const mwOpacity = smoothstep(500, 6000, fromSun) * (1 - smoothstep(4e7, 4e8, D));
    this.milkyWayPoints.uniforms.uOpacity.value = mwOpacity * 0.9;
    this.milkyWayGlow.opacity = mwOpacity * 0.55;
    this.galaxyGroup.visible = mwOpacity > 0.001;
    this.asteroidMat.uniforms.uOpacity.value = smoothstep(0.25 * AU, 1.5 * AU, D) * (1 - smoothstep(8, 36, fromSun / (2.8 * AU)));
    this.kuiperMat.uniforms.uOpacity.value = smoothstep(4 * AU, 25 * AU, D) * (1 - smoothstep(40, 160, fromSun / (45 * AU)));
    this.oortMat.uniforms.uOpacity.value = smoothstep(400 * AU, 4000 * AU, D) * (1 - smoothstep(25, 90, fromSun));
    this.webNearMat.uniforms.uOpacity.value = smoothstep(4e7, 4e8, D) * (1 - smoothstep(3e10, 1.5e11, D));
    this.webFarMat.uniforms.uOpacity.value = smoothstep(1e9, 1e10, D);
    this.cmbMat.uniforms.uOpacity.value = smoothstep(4e9, 4e10, D);
    this.cosmicGroup.visible = D > 4e7;
    const uMax = 1e13;
    for (const mat of [this.starMat, this.milkyWayPoints, this.asteroidMat, this.kuiperMat, this.oortMat, this.webNearMat, this.webFarMat, this.markerMat]) {
      mat.uniforms.uPixelRatio.value = pixelRatio;
      mat.uniforms.uMaxDist.value = uMax;
    }
    this.solarGroup.visible = fromSun < 400;

    for (const orbit of this.orbits) {
      const alpha = orbit.base * (1 - smoothstep(25, 160, fromSun / orbit.size)) * smoothstep(0.0015, 0.02, D / orbit.size);
      (orbit.line.material as THREE.LineBasicMaterial).opacity = alpha;
      orbit.line.visible = alpha > 0.003;
    }
    for (const orbit of this.moonOrbits) {
      const parent = this.byId.get(orbit.parent ?? "");
      if (!parent) continue;
      const dist = len(sub(parent.pos, cam));
      const alpha = orbit.base * (1 - smoothstep(12, 70, dist / orbit.size)) * smoothstep(0.02, 0.12, D / orbit.size);
      (orbit.line.material as THREE.LineBasicMaterial).opacity = alpha;
      orbit.line.visible = alpha > 0.003;
      if (orbit.line.visible) place(orbit.line, parent.pos, orbit.size);
    }

    // corpi e oggetti con dimensione propria
    const focus = this.byId.get(this.focusId);
    for (const e of this.entities) {
      if (!e.object) continue;
      const dist = Math.max(len(sub(e.pos, cam)), 1e-15);
      if (e.radius > 0) {
        const px = (e.radius / dist) * projScale;
        e.object.visible = px > 0.35;
        if (!e.object.visible) continue;
        place(e.object, e.pos, e.radius);
        const textureId = e.object.userData.textureId as string | null;
        if (textureId) {
          const mesh = e.object.getObjectByName("body") as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.map = surfaceTexture(textureId);
          mat.needsUpdate = true;
          e.object.userData.textureId = null;
        }
        const body = e.object.getObjectByName("body");
        if (body && e.spin) body.rotation.y += e.spin * dt;
      } else if (e.sizeLy) {
        const px = (e.sizeLy / dist) * projScale;
        const material = e.object.userData.material as THREE.Material | undefined;
        // trasparente se ci si è dentro, invisibile se più piccolo di un pixel
        const alpha = (e.baseOpacity ?? 1) * smoothstep(0.35, 1.4, dist / e.sizeLy) * smoothstep(1.5, 5, px);
        if (material) material.opacity = alpha;
        e.object.visible = alpha > 0.004;
        if (e.object.visible) place(e.object, e.pos, e.sizeLy);
      }
    }
    if (this.sunMat) this.sunMat.uniforms.uTime.value = now / 1000;

    // stella su cui si è volati
    if (focus?.kind === "star" && focus.radius > 0) {
      const px = (focus.radius / Math.max(len(sub(focus.pos, cam)), 1e-15)) * projScale;
      this.focusStar.visible = px > 0.35;
      if (this.focusStar.visible) {
        place(this.focusStar, focus.pos, focus.radius);
        const color = new THREE.Color(focus.color);
        this.focusStarMat.uniforms.uColor.value.copy(color);
        this.focusStarMat.uniforms.uTime.value = now / 1000;
        this.focusStarGlow.color.copy(color);
      }
    } else {
      this.focusStar.visible = false;
    }

    // marker, etichette e posizioni a schermo per il clic
    const positions = this.markerGeometry.attributes.position as THREE.BufferAttribute;
    const alphas = this.markerGeometry.attributes.aAlpha as THREE.BufferAttribute;
    const view = new THREE.Vector3();
    const candidates: Array<LabelCandidate & { rank: number }> = [];
    this.screen = [];
    const markerAlpha = new Map<string, number>();

    this.markerEntities.forEach((e, i) => {
      const rel = sub(e.pos, F);
      positions.setXYZ(i, rel.x * inv, rel.y * inv, rel.z * inv);
      const dist = Math.max(len(sub(e.pos, cam)), 1e-15);
      let alpha = 1 - smoothstep(60, 400, dist / e.labelLy);
      const size = e.radius > 0 ? e.radius : (e.sizeLy ?? 0) / 2;
      if (size > 0) alpha *= 1 - smoothstep(2, 7, (size / dist) * projScale);
      if (e.parent) {
        const parent = this.byId.get(e.parent);
        if (parent) alpha *= smoothstep(3, 9, (len(sub(e.pos, parent.pos)) / dist) * projScale);
      }
      alphas.setX(i, alpha);
      markerAlpha.set(e.id, alpha);
    });
    positions.needsUpdate = true;
    alphas.needsUpdate = true;

    for (const e of this.entities) {
      const dist = Math.max(len(sub(e.pos, cam)), 1e-15);
      const sunFar = this.focusId === "sun" && fromSun > 1.5;
      const focused = (e.id === this.focusId && !(e.id === "sun" && sunFar)) || (e.id === "solar-system" && sunFar);
      let show = dist < e.labelLy * 50 && dist > e.minLy;
      if (e.kind === "star" && e.absMag !== undefined) {
        const m = e.absMag + 5 * Math.log10(dist / PC) - 5;
        show = show || m < 1.7;
        if (fromSun > 9000) show = false;
      }
      if (e.parent) {
        const parent = this.byId.get(e.parent);
        if (parent && (len(sub(e.pos, parent.pos)) / dist) * projScale < 14) show = false;
      }
      const ownSize = e.radius > 0 ? e.radius : (e.sizeLy ?? 0) / 2;
      if (e.marker > 0 && (markerAlpha.get(e.id) ?? 0) < 0.15 && (ownSize / dist) * projScale <= 2) show = false;
      if (!show && !focused) continue;

      const rel = sub(e.pos, F);
      view.set(rel.x * inv, rel.y * inv, rel.z * inv).applyMatrix4(this.camera.matrixWorldInverse);
      if (view.z > 0) continue;
      view.applyMatrix4(this.camera.projectionMatrix);
      const x = (view.x * 0.5 + 0.5) * this.width;
      let y = (-view.y * 0.5 + 0.5) * this.height;
      const bodyPx = e.radius > 0 ? (e.radius / dist) * projScale : 0;
      if (bodyPx > 3) y += Math.min(bodyPx, this.height * 0.4) + 6;
      this.screen.push({ id: e.id, x, y });
      const prominence = Math.log10(dist / (e.labelLy || 1));
      candidates.push({ id: e.id, name: e.name, x, y, color: e.color, region: e.region, focused, rank: (focused ? -100 : 0) + e.priority * 3 + prominence });
    }
    candidates.sort((a, b) => a.rank - b.rank);
    this.labels.update(candidates, this.width, this.height);

    this.emitInfo(D, fromSun);
  }

  private emitInfo(D: number, fromSun: number): void {
    let level = LEVELS.find(([limit]) => D < limit) ?? LEVELS[LEVELS.length - 1];
    // a scala galattica ma lontani dalla Via Lattea (per esempio su Andromeda): si è nel Gruppo Locale
    if (level[2] === "galaxy" && fromSun > 4e5) level = [level[0], fromSun < 1.2e7 ? "Gruppo Locale" : "Galassie vicine", "local"];
    if ((level[2] === "planets" || level[2] === "solar" || level[2] === "oort") && fromSun > 2) level = [level[0], "Vicino a una stella", "stars"];
    const lyPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * D) / this.height;
    const bar = niceBar(lyPerPx * 120);
    const focusName = this.byId.get(this.focusId)?.name ?? "";
    const info: UniverseInfo = {
      level: level[1],
      scaleId: level[2],
      scaleLabel: bar.label,
      scalePx: Math.round(bar.ly / lyPerPx),
      fromSun: fromSun < 2 * KM * 1e6 ? "vicino al Sole" : `${distanceLabel(fromSun)} dal Sole`,
      focusName,
    };
    const key = `${info.level}|${info.scaleLabel}|${info.scalePx}|${info.fromSun}|${focusName}`;
    if (key === this.lastInfoKey) return;
    this.lastInfoKey = key;
    this.onView(info);
  }
}

/** Lunghezza «tonda» della barra di scala, nell'unità più comoda. */
function niceBar(ly: number): { ly: number; label: string } {
  const units: Array<[number, string, string]> = [
    [KM, "km", "km"],
    [AU, "UA", "UA"],
    [1, "anno luce", "anni luce"],
    [1e3, "mila anni luce", "mila anni luce"],
    [1e6, "milione di anni luce", "milioni di anni luce"],
    [1e9, "miliardo di anni luce", "miliardi di anni luce"],
  ];
  // si passa all'unità successiva appena il numero tondo ne raggiunge 1 (UA e anni luce da soglie astronomiche)
  const limits = [0.01 * AU, 0.05, 1e3, 1e6, 1e9, Infinity];
  const round = (value: number) => {
    const exp = Math.pow(10, Math.floor(Math.log10(value)));
    const mant = value / exp;
    return (mant < 1.5 ? 1 : mant < 3.5 ? 2 : mant < 7.5 ? 5 : 10) * exp;
  };
  let i = limits.findIndex((max) => ly < max);
  let nice = round(ly / units[i][0]);
  while (i < units.length - 1 && nice * units[i][0] >= limits[i]) {
    i++;
    nice = round(ly / units[i][0]);
  }
  const [unit, one, many] = units[i];
  const label = `${nice.toLocaleString("it-IT", { maximumFractionDigits: 3 })} ${nice === 1 ? one : many}`;
  return { ly: nice * unit, label };
}
