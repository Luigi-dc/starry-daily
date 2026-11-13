import * as THREE from "three";
import credits from "../data/texture-credits.json";

/**
 * Superfici dei corpi del sistema solare: mappe globali reali delle missioni NASA
 * (MESSENGER, Magellan, Blue Marble, LRO, Viking, Cassini, Galileo, Voyager, Dawn, New Horizons, SDO),
 * preparate da scripts/fetch-textures.py in public/textures/. Ogni mappa viene caricata solo quando serve.
 * I corpi mai fotografati da vicino (Eris, Haumea, Makemake, Sedna…) non hanno una mappa:
 * si disegnano con il loro colore medio, senza inventare una superficie.
 */

const CREDITS = credits as Record<string, { credit: string; source: string }>;
const loader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

/** Vero se per il corpo esiste una mappa reale. */
export function hasSurface(id: string): boolean {
  return id in CREDITS;
}

/** Crediti della mappa del corpo, se esiste. */
export function textureCredit(id: string): string | null {
  return CREDITS[id]?.credit ?? null;
}

/** Mappa equirettangolare del corpo, condivisa e in cache; null se il corpo non è mai stato mappato. */
export function surfaceTexture(id: string): THREE.Texture | null {
  if (!hasSurface(id)) return null;
  const cached = textureCache.get(id);
  if (cached) return cached;
  const texture = loader.load(`${import.meta.env.BASE_URL}textures/${id}.jpg`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  textureCache.set(id, texture);
  return texture;
}

/** Materiale del Sole: il disco si scurisce verso il bordo, come una stella vera. */
export function sunSurfaceMaterial(texture: THREE.Texture | null): THREE.ShaderMaterial {
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

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("contesto 2D non disponibile");
  return { canvas, ctx };
}

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

  /** Mostra il corpo indicato (con il colore dato se non ha una mappa); false se WebGL non è disponibile. */
  show(id: string, color = "#b8b2a8"): boolean {
    if (!this.renderer) return false;
    if (this.bodyId !== id) this.build(id, color);
    this.start();
    return true;
  }

  hide(): void {
    this.stop();
  }

  private build(id: string, color: string): void {
    this.disposeBody();

    const texture = surfaceTexture(id);
    const geometry = new THREE.SphereGeometry(1, 160, 96);
    const mesh =
      id === "sun"
        ? new THREE.Mesh(geometry, sunSurfaceMaterial(texture))
        : new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              map: texture,
              color: texture ? 0xffffff : new THREE.Color(color),
              roughness: 0.94,
              metalness: 0.02,
            }),
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
