import * as THREE from "three";

/**
 * Materiali dell'Universo 3D. Tutti includono i blocchi del depth buffer logaritmico,
 * necessario per disegnare insieme oggetti grandi pochi km e strutture di miliardi di anni luce.
 */

const CLAMP_FAR = /* glsl */ `
  // i punti oltre questa distanza vengono riportati più vicino: la direzione resta esatta
  float clampDist = length(mv.xyz);
  if (clampDist > uMaxDist) mv.xyz *= uMaxDist / clampDist;
`;

const SOFT_DISC = /* glsl */ `
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
`;

/** Punti luminosi a dimensione fissa in pixel: fasce, galassia, rete cosmica, marker dei corpi. */
export function glowPointsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: 1 },
      uMaxDist: { value: 1e12 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uOpacity;
      uniform float uPixelRatio;
      uniform float uSizeScale;
      uniform float uMaxDist;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        ${CLAMP_FAR}
        gl_Position = projectionMatrix * mv;
        vAlpha = aAlpha * uOpacity;
        gl_PointSize = vAlpha <= 0.001 ? 0.0 : aSize * uSizeScale * uPixelRatio;
        vColor = aColor;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        #include <logdepthbuf_fragment>
        ${SOFT_DISC}
        float a = exp(-r2 * 3.2) * (1.0 - r2);
        gl_FragColor = vec4(vColor, a * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Stelle reali: la luminosità apparente si calcola dalla magnitudine assoluta e dalla distanza
 * dalla camera, quindi da ogni punto dello spazio il cielo è quello vero.
 */
export function starMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uLimit: { value: 6.5 },
      uOpacity: { value: 1 },
      uPixelRatio: { value: 1 },
      uMaxDist: { value: 1e12 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 aColor;
      attribute float aMag;
      uniform vec3 uCam;
      uniform float uLimit;
      uniform float uOpacity;
      uniform float uPixelRatio;
      uniform float uMaxDist;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vCore;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        ${CLAMP_FAR}
        gl_Position = projectionMatrix * mv;
        float dist = max(length(position - uCam), 1e-9);
        float m = aMag + 5.0 * log(dist / 3.26156) / log(10.0) - 5.0;
        float alpha = clamp((uLimit + 1.0 - m) / 1.6, 0.0, 1.0) * uOpacity;
        vAlpha = alpha;
        float size = 1.6 * pow(10.0, 0.085 * (uLimit - m));
        vCore = clamp((uLimit - 2.0 - m) / 10.0, 0.0, 1.0);
        gl_PointSize = alpha <= 0.002 ? 0.0 : clamp(size, 1.6, 46.0) * uPixelRatio;
        vColor = aColor;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      varying vec3 vColor;
      varying float vAlpha;
      varying float vCore;
      void main() {
        #include <logdepthbuf_fragment>
        ${SOFT_DISC}
        float core = exp(-r2 * 26.0);
        float halo = exp(-r2 * 4.0) * (1.0 - r2) * (0.35 + 0.4 * vCore);
        vec3 color = mix(vColor, vec3(1.0), core * 0.7);
        gl_FragColor = vec4(color, (core + halo) * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Il Sole e le stelle viste da vicino: disco che si scurisce verso il bordo, granulazione animata. */
export function starSurfaceMaterial(color: THREE.Color, texture: THREE.Texture | null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uMap: { value: texture },
      uHasMap: { value: texture ? 1 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor;
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vPos;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : uColor;
        float g = noise(vPos * 18.0 + uTime * 0.15) * 0.6 + noise(vPos * 42.0 - uTime * 0.25) * 0.4;
        base *= 0.82 + 0.36 * g;
        float facing = clamp(vNormalView.z, 0.0, 1.0);
        float limb = 0.5 + 0.7 * pow(facing, 0.5);
        gl_FragColor = vec4(base * limb * 1.15, 1.0);
      }
    `,
  });
}

/** Il cielo di fondo visto dal sistema solare: la fascia della Via Lattea e miriadi di stelle deboli. */
export function milkyWayBackdropMaterial(galX: THREE.Vector3, galY: THREE.Vector3, galZ: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGalX: { value: galX },
      uGalY: { value: galY },
      uGalZ: { value: galZ },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uGalX;
      uniform vec3 uGalY;
      uniform vec3 uGalZ;
      uniform float uOpacity;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float gx = dot(d, uGalX);
        float gy = dot(d, uGalY);
        float gz = dot(d, uGalZ);
        float l = atan(gy, gx);
        float b = asin(clamp(gz, -1.0, 1.0));
        // fascia più spessa e luminosa verso il centro galattico
        float toward = exp(-l * l / 1.4);
        float width = 0.11 + 0.12 * toward;
        float band = exp(-(b * b) / (width * width));
        float clouds = fbm(d * 7.0);
        float dust = smoothstep(0.42, 0.72, fbm(d * 13.0 + 3.1));
        float lane = 1.0 - 0.75 * dust * exp(-(b * b) / (0.05 * 0.05 + 0.03 * toward));
        float glow = band * (0.35 + 0.65 * toward) * (0.45 + 0.75 * clouds) * lane;
        vec3 warm = vec3(1.0, 0.86, 0.68);
        vec3 cool = vec3(0.62, 0.72, 1.0);
        vec3 color = mix(cool, warm, toward * 0.8) * glow * 0.42;
        // stelle deboli: punti casuali, più fitti nella fascia
        vec3 cell = floor(d * 900.0);
        float h = hash(cell);
        float star = step(0.9965 - band * 0.004, h) * (0.35 + 0.65 * hash(cell + 7.0));
        vec3 f = fract(d * 900.0) - 0.5;
        star *= smoothstep(0.42, 0.0, length(f));
        color += vec3(0.85, 0.9, 1.0) * star * 0.55;
        // tenue chiarore diffuso
        color += vec3(0.012, 0.016, 0.03);
        gl_FragColor = vec4(color * uOpacity, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
}

/** Il bordo dell'universo osservabile: un guscio con le fluttuazioni della radiazione cosmica di fondo. */
export function cmbMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vDir;
      varying vec3 vNormalView;
      void main() {
        vDir = normalize(position);
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform float uOpacity;
      varying vec3 vDir;
      varying vec3 vNormalView;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 p = vDir * 9.0;
        float n = noise(p) * 0.5 + noise(p * 2.1) * 0.27 + noise(p * 4.3) * 0.15 + noise(p * 8.7) * 0.08;
        n = smoothstep(0.2, 0.8, n);
        vec3 cold = vec3(0.1, 0.25, 0.85);
        vec3 mid = vec3(0.85, 0.8, 0.65);
        vec3 hot = vec3(1.0, 0.42, 0.12);
        vec3 color = n < 0.5 ? mix(cold, mid, n * 2.0) : mix(mid, hot, (n - 0.5) * 2.0);
        float rim = 1.0 - abs(vNormalView.z);
        float alpha = uOpacity * (0.16 + 0.5 * pow(rim, 2.5));
        gl_FragColor = vec4(color, alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
