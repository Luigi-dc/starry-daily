import type { Kind, SkyObject } from "./objects";

export type SolarKind = Extract<Kind, "planet" | "moon" | "sun">;

export interface SolarBody extends SkyObject {
  kind: SolarKind;
  /** Nomi alternativi usati dalla ricerca (italiano e inglese). */
  aliases: string[];
  /** Due colori per disegnare il disco nella scheda. */
  tint: [string, string];
  /** Scheda NASA ufficiale del corpo celeste. */
  link: string;
  /** Dati fisici principali (diametro, massa, periodi...). */
  facts: Array<{ label: string; value: string }>;
  /** Distanza geocentrica in UA (assente per Sole e Luna). */
  au?: number;
  /** Vero per la Terra: è il punto di osservazione, non ha una direzione nel cielo. */
  observer?: boolean;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const norm360 = (value: number) => ((value % 360) + 360) % 360;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Giorni dal 2000 gennaio 0.0 (epoca usata dagli elementi orbitali di Schlyter). */
function daysSinceEpoch(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  return (
    367 * year -
    Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4) +
    Math.floor((275 * month) / 9) +
    day -
    730530 +
    hours / 24
  );
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let e = meanAnomaly + eccentricity * Math.sin(meanAnomaly) * (1 + eccentricity * Math.cos(meanAnomaly));
  for (let i = 0; i < 8; i++) {
    const delta = (e - eccentricity * Math.sin(e) - meanAnomaly) / (1 - eccentricity * Math.cos(e));
    e -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }
  return e;
}

/** [N, N', i, i', w, w', a, a', e, e', M, M'] con angoli in gradi e ratei per giorno. */
type Elements = [
  number, number, number, number, number, number,
  number, number, number, number, number, number,
];

const ORBITS: Record<string, Elements> = {
  mercury: [48.3313, 3.24587e-5, 7.0047, 5e-8, 29.1241, 1.01444e-5, 0.387098, 0, 0.205635, 5.59e-10, 168.6562, 4.0923344368],
  venus: [76.6799, 2.4659e-5, 3.3946, 2.75e-8, 54.891, 1.38374e-5, 0.72333, 0, 0.006773, -1.302e-9, 48.0052, 1.6021302244],
  mars: [49.5574, 2.11081e-5, 1.8497, -1.78e-8, 286.5016, 2.92961e-5, 1.523688, 0, 0.093405, 2.516e-9, 18.6021, 0.5240207766],
  jupiter: [100.4542, 2.76854e-5, 1.303, -1.557e-7, 273.8777, 1.64505e-5, 5.20256, 0, 0.048498, 4.469e-9, 19.895, 0.0830853001],
  saturn: [113.6634, 2.3898e-5, 2.4886, -1.081e-7, 339.3939, 2.97661e-5, 9.55475, 0, 0.055546, -9.499e-9, 316.967, 0.0334442282],
  uranus: [74.0005, 1.3978e-5, 0.7733, 1.9e-8, 96.6612, 3.0565e-5, 19.18171, -1.55e-8, 0.047318, 7.45e-9, 142.5905, 0.011725806],
  neptune: [131.7806, 3.0173e-5, 1.77, -2.55e-7, 272.8461, -6.027e-6, 30.05826, 3.313e-8, 0.008606, 2.15e-9, 260.2471, 0.005995147],
};

interface Vector {
  x: number;
  y: number;
  z: number;
}

/** Posizione eliocentrica (UA) nel piano eclittico. */
function heliocentric(el: Elements, d: number) {
  const node = (el[0] + el[1] * d) * DEG;
  const incl = (el[2] + el[3] * d) * DEG;
  const peri = (el[4] + el[5] * d) * DEG;
  const a = el[6] + el[7] * d;
  const ecc = el[8] + el[9] * d;
  const mean = norm360(el[10] + el[11] * d) * DEG;

  const E = solveKepler(mean, ecc);
  const xv = a * (Math.cos(E) - ecc);
  const yv = a * Math.sqrt(1 - ecc * ecc) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const vw = v + peri;

  return {
    x: r * (Math.cos(node) * Math.cos(vw) - Math.sin(node) * Math.sin(vw) * Math.cos(incl)),
    y: r * (Math.sin(node) * Math.cos(vw) + Math.cos(node) * Math.sin(vw) * Math.cos(incl)),
    z: r * Math.sin(vw) * Math.sin(incl),
    r,
  };
}

/** Posizione geocentrica del Sole (UA) e longitudine eclittica. */
function sunGeocentric(d: number) {
  const w = (282.9404 + 4.70935e-5 * d) * DEG;
  const ecc = 0.016709 - 1.151e-9 * d;
  const mean = norm360(356.047 + 0.9856002585 * d) * DEG;

  const E = solveKepler(mean, ecc);
  const xv = Math.cos(E) - ecc;
  const yv = Math.sqrt(1 - ecc * ecc) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const lon = v + w;

  return {
    x: r * Math.cos(lon),
    y: r * Math.sin(lon),
    z: 0,
    lon: lon * RAD,
    r,
    mean: norm360(mean * RAD),
  };
}

/** Posizione geocentrica della Luna in raggi terrestri, con le perturbazioni principali. */
function moonPosition(d: number) {
  const N = norm360(125.1228 - 0.0529538083 * d);
  const incl = 5.1454 * DEG;
  const w = 318.0634 + 0.1643573223 * d;
  const a = 60.2666;
  const ecc = 0.0549;
  const M = norm360(115.3654 + 13.0649929509 * d);
  const Mr = M * DEG;

  const E = solveKepler(Mr, ecc);
  const xv = a * (Math.cos(E) - ecc);
  const yv = a * Math.sqrt(1 - ecc * ecc) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const vw = v + w * DEG;
  const nr = N * DEG;

  let x = r * (Math.cos(nr) * Math.cos(vw) - Math.sin(nr) * Math.sin(vw) * Math.cos(incl));
  let y = r * (Math.sin(nr) * Math.cos(vw) + Math.cos(nr) * Math.sin(vw) * Math.cos(incl));
  let z = r * Math.sin(vw) * Math.sin(incl);

  let lon = Math.atan2(y, x) * RAD;
  let lat = Math.atan2(z, Math.hypot(x, y)) * RAD;
  let dist = Math.hypot(x, y, z);

  const sun = sunGeocentric(d);
  const lm = norm360(N + w + M);
  const D = norm360(lm - sun.lon) * DEG;
  const F = norm360(lm - N) * DEG;
  const Ms = sun.mean * DEG;

  lon +=
    -1.274 * Math.sin(Mr - 2 * D) +
    0.658 * Math.sin(2 * D) -
    0.186 * Math.sin(Ms) -
    0.059 * Math.sin(2 * Mr - 2 * D) -
    0.057 * Math.sin(Mr - 2 * D + Ms) +
    0.053 * Math.sin(Mr + 2 * D) +
    0.046 * Math.sin(2 * D - Ms) +
    0.041 * Math.sin(Mr - Ms) -
    0.035 * Math.sin(D) -
    0.031 * Math.sin(Mr + Ms) -
    0.015 * Math.sin(2 * F - 2 * D) +
    0.011 * Math.sin(Mr - 4 * D);

  lat +=
    -0.173 * Math.sin(F - 2 * D) -
    0.055 * Math.sin(Mr - F - 2 * D) -
    0.046 * Math.sin(Mr + F - 2 * D) +
    0.033 * Math.sin(F + 2 * D) +
    0.017 * Math.sin(2 * Mr + F);

  dist += -0.58 * Math.cos(Mr - 2 * D) - 0.46 * Math.cos(2 * D);

  const lonR = lon * DEG;
  const latR = lat * DEG;
  x = dist * Math.cos(latR) * Math.cos(lonR);
  y = dist * Math.cos(latR) * Math.sin(lonR);
  z = dist * Math.sin(latR);

  return { x, y, z, km: dist * 6378.14 };
}

/** Da coordinate eclittiche geocentriche a RA (ore) e Dec (gradi). */
function toEquatorial(v: Vector, d: number): { ra: number; dec: number } {
  const eps = (23.4393 - 3.563e-7 * d) * DEG;
  const xe = v.x;
  const ye = v.y * Math.cos(eps) - v.z * Math.sin(eps);
  const ze = v.y * Math.sin(eps) + v.z * Math.cos(eps);
  const norm = Math.hypot(xe, ye, ze) || 1;

  let ra = Math.atan2(ye, xe) * RAD / 15;
  if (ra < 0) ra += 24;

  return { ra, dec: Math.asin(clamp(ze / norm, -1, 1)) * RAD };
}

interface BodySpec {
  id: string;
  name: string;
  kind: SolarKind;
  aliases: string[];
  tint: [string, string];
  link: string;
  description: string;
}

const SPECS: BodySpec[] = [
  {
    id: "sun",
    name: "Sole",
    kind: "sun",
    aliases: ["Sun", "stella", "stelle"],
    tint: ["#fff2b8", "#ff9b2f"],
    link: "https://science.nasa.gov/sun/",
    description:
      "La stella che tiene insieme il sistema solare: nella fotosfera l'idrogeno fonde in elio, trasformando circa 600 milioni di tonnellate di materia al secondo. Le sonde Parker Solar Probe e Solar Orbiter ne studiano la corona e il vento.",
  },
  {
    id: "moon",
    name: "Luna",
    kind: "moon",
    aliases: ["Moon", "satellite naturale", "selene"],
    tint: ["#f2f4f9", "#6c7280"],
    link: "https://science.nasa.gov/moon/",
    description:
      "L'unico satellite naturale della Terra, in rotazione sincrona: mostra sempre la stessa faccia. Le missioni Apollo e le sonde recenti ne hanno mappato i crateri e il ghiaccio d'acqua nelle zone in ombra dei poli.",
  },
  {
    id: "earth",
    name: "Terra",
    kind: "planet",
    aliases: ["Earth", "pianeta azzurro", "mondo", "pianeta terra"],
    tint: ["#9ec9ff", "#123a6b"],
    link: "https://science.nasa.gov/earth/",
    description:
      "Il pianeta da cui guardiamo il cielo: il 71% della superficie è coperto da oceani, l'atmosfera di azoto e ossigeno protegge la vita e il campo magnetico devia il vento solare verso i poli, dove nascono le aurore. Proprio perché ci stiamo sopra, la Terra non ha una posizione nella mappa celeste.",
  },
  {
    id: "mercury",
    name: "Mercurio",
    kind: "planet",
    aliases: ["Mercury"],
    tint: ["#b9b0a6", "#4a433c"],
    link: "https://science.nasa.gov/solar-system/planets/mercury/",
    description:
      "Il pianeta più vicino al Sole, con un'atmosfera quasi assente: la superficie craterizzata supera i 400 °C nel giorno e scende sotto i −170 °C nella notte. Lo hanno studiato Mariner 10, MESSENGER e BepiColombo.",
  },
  {
    id: "venus",
    name: "Venere",
    kind: "planet",
    aliases: ["Venus", "stella della sera", "stella del mattino"],
    tint: ["#f7e6c0", "#a97c3f"],
    link: "https://science.nasa.gov/solar-system/planets/venus/",
    description:
      "Avvolto da nubi di acido solforico e da un'atmosfera densissima, ha una temperatura al suolo di circa 465 °C: è il pianeta più caldo del sistema solare, più di Mercurio che gli sta davanti.",
  },
  {
    id: "mars",
    name: "Marte",
    kind: "planet",
    aliases: ["Mars", "pianeta rosso"],
    tint: ["#d97a52", "#5f2312"],
    link: "https://science.nasa.gov/solar-system/planets/mars/",
    description:
      "Deve il colore rosso all'ossido di ferro: ospita Olympus Mons, il vulcano più alto conosciuto, e canyon lunghi migliaia di chilometri. I rover e le sonde orbitanti cercano tracce di acqua e di vita passata.",
  },
  {
    id: "jupiter",
    name: "Giove",
    kind: "planet",
    aliases: ["Jupiter", "gigante gassoso"],
    tint: ["#edd2a4", "#a06a35"],
    link: "https://science.nasa.gov/solar-system/planets/jupiter/",
    description:
      "Il pianeta più massiccio del sistema solare, con la Grande Macchia Rossa e decine di lune. Le missioni Galileo e Juno hanno rivelato un campo magnetico intensissimo e indizi di un oceano sotto la crosta ghiacciata di Europa.",
  },
  {
    id: "saturn",
    name: "Saturno",
    kind: "planet",
    aliases: ["Saturn", "anelli di saturno"],
    tint: ["#ecd9a8", "#9b7c46"],
    link: "https://science.nasa.gov/solar-system/planets/saturn/",
    description:
      "Celebre per gli anelli di ghiaccio, larghi centinaia di migliaia di chilometri ma spessi poche decine di metri. La missione Cassini li ha studiati per tredici anni, scoprendo getti d'acqua su Encelado.",
  },
  {
    id: "uranus",
    name: "Urano",
    kind: "planet",
    aliases: ["Uranus", "gigante di ghiaccio"],
    tint: ["#b9eaee", "#3f7d86"],
    link: "https://science.nasa.gov/solar-system/planets/uranus/",
    description:
      "Un gigante ghiacciato con l'asse inclinato di quasi 98°: rotola cioè lungo la propria orbita. Il metano presente nell'atmosfera gli dà il caratteristico colore verde-azzurro.",
  },
  {
    id: "neptune",
    name: "Nettuno",
    kind: "planet",
    aliases: ["Neptune", "gigante di ghiaccio"],
    tint: ["#7fa6ff", "#1f2f7a"],
    link: "https://science.nasa.gov/solar-system/planets/neptune/",
    description:
      "Il pianeta più lontano dal Sole, con venti che raggiungono i 2.000 km/h: i più veloci misurati nel sistema solare. È stato visitato una sola volta, dalla sonda Voyager 2 nel 1989.",
  },
];

/** Dati fisici mostrati nella scheda e nel lettore interno. */
const FACTS: Record<string, Array<{ label: string; value: string }>> = {
  sun: [
    { label: "Diametro", value: "1.392.700 km" },
    { label: "Massa", value: "1,989 × 10³⁰ kg" },
    { label: "Rotazione", value: "25,4 giorni all'equatore" },
    { label: "Temperatura", value: "5.500 °C in superficie" },
    { label: "Età", value: "circa 4,6 miliardi di anni" },
    { label: "Tipo", value: "nana gialla G2V" },
  ],
  moon: [
    { label: "Diametro", value: "3.474 km" },
    { label: "Massa", value: "7,35 × 10²² kg" },
    { label: "Distanza media", value: "384.400 km" },
    { label: "Giorno", value: "27,3 giorni (rotazione sincrona)" },
    { label: "Temperatura", value: "da −173 a +127 °C" },
    { label: "Gravità", value: "1,62 m/s² (0,16 g)" },
  ],
  earth: [
    { label: "Diametro", value: "12.742 km" },
    { label: "Massa", value: "5,97 × 10²⁴ kg" },
    { label: "Anno", value: "365,26 giorni" },
    { label: "Giorno", value: "23 h 56 min" },
    { label: "Temperatura media", value: "circa 15 °C" },
    { label: "Lune", value: "1 (la Luna)" },
  ],
  mercury: [
    { label: "Diametro", value: "4.879 km" },
    { label: "Massa", value: "3,30 × 10²³ kg" },
    { label: "Anno", value: "88 giorni" },
    { label: "Giorno solare", value: "176 giorni terrestri" },
    { label: "Temperatura", value: "da −180 a +430 °C" },
    { label: "Lune", value: "nessuna" },
  ],
  venus: [
    { label: "Diametro", value: "12.104 km" },
    { label: "Massa", value: "4,87 × 10²⁴ kg" },
    { label: "Anno", value: "225 giorni" },
    { label: "Rotazione", value: "243 giorni, retrograda" },
    { label: "Temperatura", value: "circa 465 °C" },
    { label: "Lune", value: "nessuna" },
  ],
  mars: [
    { label: "Diametro", value: "6.779 km" },
    { label: "Massa", value: "6,42 × 10²³ kg" },
    { label: "Anno", value: "687 giorni" },
    { label: "Giorno", value: "24 h 37 min" },
    { label: "Temperatura", value: "da −125 a +20 °C" },
    { label: "Lune", value: "2 (Phobos e Deimos)" },
  ],
  jupiter: [
    { label: "Diametro", value: "139.820 km" },
    { label: "Massa", value: "1,90 × 10²⁷ kg" },
    { label: "Anno", value: "11,9 anni" },
    { label: "Giorno", value: "9 h 56 min" },
    { label: "Temperatura", value: "circa −145 °C" },
    { label: "Lune note", value: "oltre 90" },
  ],
  saturn: [
    { label: "Diametro", value: "116.460 km" },
    { label: "Massa", value: "5,68 × 10²⁶ kg" },
    { label: "Anno", value: "29,4 anni" },
    { label: "Giorno", value: "10 h 42 min" },
    { label: "Temperatura", value: "circa −178 °C" },
    { label: "Lune note", value: "oltre 270" },
  ],
  uranus: [
    { label: "Diametro", value: "50.724 km" },
    { label: "Massa", value: "8,68 × 10²⁵ kg" },
    { label: "Anno", value: "84 anni" },
    { label: "Giorno", value: "17 h 14 min" },
    { label: "Inclinazione", value: "97,8° sull'orbita" },
    { label: "Lune note", value: "oltre 25" },
  ],
  neptune: [
    { label: "Diametro", value: "49.244 km" },
    { label: "Massa", value: "1,02 × 10²⁶ kg" },
    { label: "Anno", value: "165 anni" },
    { label: "Giorno", value: "16 h 6 min" },
    { label: "Venti", value: "fino a 2.100 km/h" },
    { label: "Lune note", value: "oltre 15" },
  ],
};

const nf = (value: number, digits: number) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const AU_KM_MILLIONS = 149.59787;

function computeBodies(now: Date): SolarBody[] {
  const d = daysSinceEpoch(now);
  const sun = sunGeocentric(d);
  const bodies: SolarBody[] = [];

  for (const spec of SPECS) {
    const base = {
      id: spec.id,
      name: spec.name,
      kind: spec.kind,
      aliases: spec.aliases,
      tint: spec.tint,
      link: spec.link,
      description: spec.description,
      facts: FACTS[spec.id] ?? [],
    };

    if (spec.id === "sun") {
      const eq = toEquatorial({ x: sun.x, y: sun.y, z: sun.z }, d);
      bodies.push({ ...base, ra: eq.ra, dec: eq.dec, distance: `${nf(sun.r * AU_KM_MILLIONS, 1)} milioni di km` });
      continue;
    }

    if (spec.id === "earth") {
      // la Terra è il punto di osservazione: nessuna direzione nel cielo
      bodies.push({ ...base, ra: 0, dec: 0, distance: "sei qui · punto di osservazione", observer: true });
      continue;
    }

    if (spec.id === "moon") {
      const moon = moonPosition(d);
      const eq = toEquatorial({ x: moon.x, y: moon.y, z: moon.z }, d);
      bodies.push({ ...base, ra: eq.ra, dec: eq.dec, distance: `${nf(moon.km, 0)} km` });
      continue;
    }

    const orbit = ORBITS[spec.id];
    if (!orbit) continue;
    const helio = heliocentric(orbit, d);
    const geo = { x: helio.x + sun.x, y: helio.y + sun.y, z: helio.z + sun.z };
    const eq = toEquatorial(geo, d);
    const au = Math.hypot(geo.x, geo.y, geo.z);

    bodies.push({
      ...base,
      ra: eq.ra,
      dec: eq.dec,
      distance: `${nf(au, 2)} UA · ${nf(au * AU_KM_MILLIONS, 1)} milioni di km`,
      au,
    });
  }

  return bodies;
}

/** Istante di calcolo delle posizioni planetarie. */
export const SOLAR_COMPUTED_AT = new Date();

export const SOLAR_BODIES: SolarBody[] = computeBodies(SOLAR_COMPUTED_AT);
