import type { SkyObject } from "./objects";
import {
  SOLAR_COMPUTED_AT,
  daysSinceEpoch,
  heliocentric,
  sunGeocentric,
  toEquatorial,
  type Elements,
  type Vector,
} from "./solar";

/**
 * Corpi minori del sistema solare (pianeti nani, asteroidi, comete), lune principali e sonde.
 * Gli elementi orbitali vengono dal JPL Small-Body Database (eclittica J2000), convertiti
 * nel formato di Schlyter usato da solar.ts: [N, N', i, i', w, w', a, a', e, e', M, M']
 * con l'anomalia media M riferita al 2000 gennaio 0.0.
 */

type Fact = { label: string; value: string };

export interface MinorBody extends SkyObject {
  kind: "dwarf" | "asteroid" | "comet";
  aliases: string[];
  facts: Fact[];
  elements: Elements;
  radiusKm: number;
  color: string;
  /** Posizione eliocentrica eclittica di oggi (UA). */
  helio: Vector;
  link: string;
}

export interface MoonBody extends SkyObject {
  kind: "moon";
  aliases: string[];
  facts: Fact[];
  parent: string;
  /** Semiasse maggiore dell'orbita attorno al pianeta (km). */
  aKm: number;
  /** Periodo orbitale (giorni); negativo se retrogrado. */
  periodDays: number;
  radiusKm: number;
  color: string;
}

export interface ProbeBody extends SkyObject {
  kind: "probe";
  aliases: string[];
  facts: Fact[];
  /** Distanza dal Sole oggi (UA, stima lineare). */
  au: number;
  link: string;
}

interface MinorSpec {
  id: string;
  name: string;
  kind: MinorBody["kind"];
  aliases: string[];
  elements: Elements;
  radiusKm: number;
  color: string;
  link: string;
  description: string;
  facts: Fact[];
}

const MINOR_SPECS: MinorSpec[] = [
  {
    id: "ceres",
    name: "Cerere",
    kind: "dwarf",
    aliases: ["Ceres", "1 Ceres"],
    elements: [80.2486, 0, 10.588, 0, 73.2942, 0, 2.76555, 0, 0.079692, 0, 4.8813, 0.214304451],
    radiusKm: 470,
    color: "#a09c96",
    link: "https://science.nasa.gov/dwarf-planets/ceres/",
    description:
      "Il corpo più grande della fascia degli asteroidi e l'unico pianeta nano del sistema solare interno. La sonda Dawn ha scoperto macchie brillanti di sali nel cratere Occator, residui di una salamoia risalita dall'interno.",
    facts: [
      { label: "Diametro", value: "939 km" },
      { label: "Anno", value: "4,6 anni" },
      { label: "Giorno", value: "9 h 4 min" },
      { label: "Scoperto", value: "1801, Giuseppe Piazzi (Palermo)" },
    ],
  },
  {
    id: "vesta",
    name: "Vesta",
    kind: "asteroid",
    aliases: ["4 Vesta"],
    elements: [103.7013, 0, 7.1439, 0, 151.4686, 0, 2.36137, 0, 0.090204, 0, 338.1716, 0.271618361],
    radiusKm: 262,
    color: "#b3aa9e",
    link: "https://science.nasa.gov/solar-system/asteroids/4-vesta/",
    description:
      "Il secondo asteroide per massa, un protopianeta rimasto a metà: ha un nucleo di ferro e una crosta basaltica. Al polo sud c'è Rheasilvia, un cratere largo 500 km con un picco centrale alto più di 20 km.",
    facts: [
      { label: "Diametro", value: "525 km" },
      { label: "Anno", value: "3,6 anni" },
      { label: "Giorno", value: "5 h 20 min" },
      { label: "Esplorato da", value: "Dawn (2011–2012)" },
    ],
  },
  {
    id: "pallas",
    name: "Pallade",
    kind: "asteroid",
    aliases: ["Pallas", "2 Pallas"],
    elements: [172.8866, 0, 34.9328, 0, 310.9699, 0, 2.76956, 0, 0.2307, 0, 349.2006, 0.213839603],
    radiusKm: 256,
    color: "#9a999e",
    link: "https://science.nasa.gov/solar-system/asteroids/",
    description:
      "Il terzo asteroide per dimensioni, con un'orbita molto inclinata (35°) rispetto al piano dei pianeti. La superficie è segnata da crateri profondi, segno di collisioni frequenti.",
    facts: [
      { label: "Diametro", value: "513 km" },
      { label: "Anno", value: "4,6 anni" },
      { label: "Scoperto", value: "1802, Heinrich Olbers" },
    ],
  },
  {
    id: "pluto",
    name: "Plutone",
    kind: "dwarf",
    aliases: ["Pluto", "134340"],
    elements: [110.2924, 0, 17.1477, 0, 113.709, 0, 39.58863, 0, 0.251838, 0, 14.7646, 0.00395683896],
    radiusKm: 1188,
    color: "#d9bf9c",
    link: "https://science.nasa.gov/dwarf-planets/pluto/",
    description:
      "Il pianeta nano più famoso, nella fascia di Kuiper. Nel 2015 New Horizons ha mostrato pianure di ghiaccio di azoto a forma di cuore (Sputnik Planitia), montagne di ghiaccio d'acqua e una tenue atmosfera azzurrina.",
    facts: [
      { label: "Diametro", value: "2.377 km" },
      { label: "Anno", value: "248 anni" },
      { label: "Giorno", value: "6,4 giorni, retrogrado" },
      { label: "Lune", value: "5 (Caronte la più grande)" },
      { label: "Temperatura", value: "circa −230 °C" },
    ],
  },
  {
    id: "haumea",
    name: "Haumea",
    kind: "dwarf",
    aliases: ["136108"],
    elements: [121.7861, 0, 28.2085, 0, 240.6905, 0, 43.06029, 0, 0.194443, 0, 189.5259, 0.00348809773],
    radiusKm: 798,
    color: "#e6e7ea",
    link: "https://science.nasa.gov/dwarf-planets/haumea/",
    description:
      "Un pianeta nano a forma di pallone da rugby: ruota su se stesso in meno di 4 ore, la rotazione più rapida tra i grandi corpi del sistema solare. Ha un anello e due piccole lune.",
    facts: [
      { label: "Dimensioni", value: "circa 2.100 × 1.680 × 1.070 km" },
      { label: "Anno", value: "284 anni" },
      { label: "Giorno", value: "3 h 55 min" },
    ],
  },
  {
    id: "makemake",
    name: "Makemake",
    kind: "dwarf",
    aliases: ["136472"],
    elements: [79.2948, 0, 29.0279, 0, 297.0923, 0, 45.57093, 0, 0.158889, 0, 138.9984, 0.00320385012],
    radiusKm: 715,
    color: "#c88a68",
    link: "https://science.nasa.gov/dwarf-planets/makemake/",
    description:
      "Il secondo oggetto più luminoso della fascia di Kuiper dopo Plutone, rossastro per i composti organici (toline) formati dalla luce solare sul ghiaccio di metano.",
    facts: [
      { label: "Diametro", value: "circa 1.430 km" },
      { label: "Anno", value: "305 anni" },
      { label: "Lune", value: "1 (MK2)" },
    ],
  },
  {
    id: "eris",
    name: "Eris",
    kind: "dwarf",
    aliases: ["136199", "Xena"],
    elements: [36.0048, 0, 43.9258, 0, 150.7949, 0, 67.93395, 0, 0.438239, 0, 194.7757, 0.00176024777],
    radiusKm: 1163,
    color: "#f2f1ec",
    link: "https://science.nasa.gov/dwarf-planets/eris/",
    description:
      "Grande quasi come Plutone ma più massiccia: la sua scoperta nel 2005 portò l'Unione Astronomica Internazionale a definire i «pianeti nani». Oggi si trova a quasi 100 UA dal Sole.",
    facts: [
      { label: "Diametro", value: "2.326 km" },
      { label: "Anno", value: "559 anni" },
      { label: "Lune", value: "1 (Disnomia)" },
    ],
  },
  {
    id: "quaoar",
    name: "Quaoar",
    kind: "dwarf",
    aliases: ["50000"],
    elements: [188.9191, 0, 7.9916, 0, 163.209, 0, 43.15618, 0, 0.0352, 0, 259.2764, 0.00347647921],
    radiusKm: 545,
    color: "#94604c",
    link: "https://science.nasa.gov/solar-system/kuiper-belt/",
    description:
      "Candidato pianeta nano della fascia di Kuiper con un anello sorprendentemente lontano dalla superficie, ben oltre il limite in cui la gravità dovrebbe trasformarlo in una luna.",
    facts: [
      { label: "Diametro", value: "circa 1.090 km" },
      { label: "Anno", value: "284 anni" },
    ],
  },
  {
    id: "sedna",
    name: "Sedna",
    kind: "dwarf",
    aliases: ["90377"],
    elements: [144.5062, 0, 11.9253, 0, 311.0988, 0, 543.71953, 0, 0.859882, 0, 357.845, 7.7739488e-5],
    radiusKm: 500,
    color: "#b14a30",
    link: "https://science.nasa.gov/solar-system/kuiper-belt/",
    description:
      "Uno dei corpi più rossi e lontani conosciuti: la sua orbita va da 76 a circa 1.000 UA e richiede più di 11.000 anni. Potrebbe essere stata deformata da una stella passata vicino al Sole quando era giovane.",
    facts: [
      { label: "Diametro", value: "circa 1.000 km" },
      { label: "Anno", value: "circa 11.400 anni" },
      { label: "Perielio", value: "76 UA (nel 2076)" },
    ],
  },
  {
    id: "halley",
    name: "Cometa di Halley",
    kind: "comet",
    aliases: ["1P/Halley", "Halley", "1P"],
    elements: [59.0989, 0, 162.1905, 0, 112.2414, 0, 17.92864, 0, 0.967936, 0, 65.8708, 0.0129832444],
    radiusKm: 5.5,
    color: "#8ff0e0",
    link: "https://science.nasa.gov/solar-system/comets/1p-halley/",
    description:
      "La cometa periodica più famosa, visibile a occhio nudo ogni 75–76 anni. La sonda europea Giotto ne fotografò il nucleo nel 1986; tornerà vicino al Sole nel 2061.",
    facts: [
      { label: "Nucleo", value: "15 × 8 km" },
      { label: "Periodo", value: "circa 76 anni" },
      { label: "Prossimo perielio", value: "luglio 2061" },
    ],
  },
  {
    id: "encke",
    name: "Cometa di Encke",
    kind: "comet",
    aliases: ["2P/Encke", "Encke", "2P"],
    elements: [334.0138, 0, 11.3396, 0, 187.2834, 0, 2.21834, 0, 0.846997, 0, 285.7674, 0.298306473],
    radiusKm: 2.4,
    color: "#8ff0e0",
    link: "https://science.nasa.gov/solar-system/comets/2p-encke/",
    description:
      "La cometa con il periodo più breve conosciuto, appena 3,3 anni. I detriti che lascia lungo l'orbita producono lo sciame meteorico delle Tauridi.",
    facts: [
      { label: "Nucleo", value: "circa 4,8 km" },
      { label: "Periodo", value: "3,3 anni" },
    ],
  },
  {
    id: "67p",
    name: "67P/Churyumov-Gerasimenko",
    kind: "comet",
    aliases: ["67P", "Rosetta", "Churyumov"],
    elements: [50.1356, 0, 7.0403, 0, 12.7982, 0, 3.46225, 0, 0.640908, 0, 207.3245, 0.152991229],
    radiusKm: 2,
    color: "#8ff0e0",
    link: "https://science.esa.int/rosetta/",
    description:
      "La cometa a forma di «papera» studiata da vicino dalla sonda ESA Rosetta tra il 2014 e il 2016; il lander Philae è stato il primo oggetto a posarsi su un nucleo cometario.",
    facts: [
      { label: "Nucleo", value: "4,1 × 3,3 km" },
      { label: "Periodo", value: "6,4 anni" },
    ],
  },
];

const nf = (value: number, digits: number) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function computeMinor(now: Date): MinorBody[] {
  const d = daysSinceEpoch(now);
  const sun = sunGeocentric(d);
  return MINOR_SPECS.map((spec) => {
    const helio = heliocentric(spec.elements, d);
    const geo = { x: helio.x + sun.x, y: helio.y + sun.y, z: helio.z + sun.z };
    const eq = toEquatorial(geo, d);
    const au = Math.hypot(geo.x, geo.y, geo.z);
    return {
      id: spec.id,
      name: spec.name,
      kind: spec.kind,
      aliases: spec.aliases,
      facts: spec.facts,
      elements: spec.elements,
      radiusKm: spec.radiusKm,
      color: spec.color,
      link: spec.link,
      description: spec.description,
      ra: eq.ra,
      dec: eq.dec,
      helio: { x: helio.x, y: helio.y, z: helio.z },
      distance: `${nf(au, 2)} UA dalla Terra · ${nf(helio.r, 2)} UA dal Sole`,
    };
  });
}

export const MINOR_BODIES: MinorBody[] = computeMinor(SOLAR_COMPUTED_AT);

type MoonSpec = Omit<MoonBody, "ra" | "dec" | "kind" | "distance"> & { distance?: string };

/** Lune principali: orbite circolari semplificate nel piano equatoriale del pianeta. */
const MOON_SPECS: MoonSpec[] = [
  {
    id: "phobos",
    name: "Phobos",
    parent: "mars",
    aliases: ["Fobos"],
    aKm: 9376,
    periodDays: 0.319,
    radiusKm: 11,
    color: "#6e604f",
    description: "La luna più grande di Marte, un sasso irregolare che orbita così vicino da avvicinarsi di 2 metri ogni secolo: tra circa 50 milioni di anni si frantumerà in un anello.",
    facts: [{ label: "Dimensioni", value: "27 × 22 × 18 km" }, { label: "Orbita", value: "7 h 39 min" }],
  },
  {
    id: "deimos",
    name: "Deimos",
    parent: "mars",
    aliases: [],
    aKm: 23463,
    periodDays: 1.263,
    radiusKm: 6,
    color: "#8c7c69",
    description: "La luna più piccola e lontana di Marte, probabilmente un asteroide catturato o un frammento di un antico impatto.",
    facts: [{ label: "Dimensioni", value: "15 × 12 × 11 km" }, { label: "Orbita", value: "30 h 18 min" }],
  },
  {
    id: "io",
    name: "Io",
    parent: "jupiter",
    aliases: [],
    aKm: 421700,
    periodDays: 1.769,
    radiusKm: 1822,
    color: "#e8c25c",
    description: "Il corpo più vulcanico del sistema solare: le maree di Giove lo scaldano dall'interno e centinaia di vulcani lanciano zolfo fino a 400 km di altezza.",
    facts: [{ label: "Diametro", value: "3.643 km" }, { label: "Orbita", value: "1,8 giorni" }, { label: "Scoperta", value: "1610, Galileo Galilei" }],
  },
  {
    id: "europa",
    name: "Europa",
    parent: "jupiter",
    aliases: [],
    aKm: 671034,
    periodDays: 3.551,
    radiusKm: 1561,
    color: "#e9dfcd",
    description: "Sotto la crosta di ghiaccio solcata da fratture nasconde un oceano salato con più acqua di tutti gli oceani terrestri: uno dei posti più promettenti per cercare la vita. La sonda Europa Clipper è in viaggio.",
    facts: [{ label: "Diametro", value: "3.122 km" }, { label: "Orbita", value: "3,6 giorni" }, { label: "Scoperta", value: "1610, Galileo Galilei" }],
  },
  {
    id: "ganymede",
    name: "Ganimede",
    parent: "jupiter",
    aliases: ["Ganymede"],
    aKm: 1070412,
    periodDays: 7.155,
    radiusKm: 2634,
    color: "#a89c8e",
    description: "La luna più grande del sistema solare, più grande di Mercurio, e l'unica con un proprio campo magnetico. La sonda ESA JUICE ci entrerà in orbita nel 2034.",
    facts: [{ label: "Diametro", value: "5.268 km" }, { label: "Orbita", value: "7,2 giorni" }, { label: "Scoperta", value: "1610, Galileo Galilei" }],
  },
  {
    id: "callisto",
    name: "Callisto",
    parent: "jupiter",
    aliases: [],
    aKm: 1882709,
    periodDays: 16.689,
    radiusKm: 2410,
    color: "#7a6d5f",
    description: "La superficie più craterizzata del sistema solare: un paesaggio antichissimo, quasi immutato da 4 miliardi di anni.",
    facts: [{ label: "Diametro", value: "4.821 km" }, { label: "Orbita", value: "16,7 giorni" }, { label: "Scoperta", value: "1610, Galileo Galilei" }],
  },
  {
    id: "enceladus",
    name: "Encelado",
    parent: "saturn",
    aliases: ["Enceladus"],
    aKm: 238042,
    periodDays: 1.37,
    radiusKm: 252,
    color: "#f4f8fb",
    description: "Una piccola luna bianchissima che dal polo sud spruzza getti di acqua salata nello spazio: Cassini li ha attraversati trovando molecole organiche.",
    facts: [{ label: "Diametro", value: "504 km" }, { label: "Orbita", value: "1,4 giorni" }],
  },
  {
    id: "titan",
    name: "Titano",
    parent: "saturn",
    aliases: ["Titan"],
    aKm: 1221870,
    periodDays: 15.945,
    radiusKm: 2575,
    color: "#d9a457",
    description: "L'unica luna con un'atmosfera densa e l'unico mondo oltre la Terra con laghi e fiumi in superficie, ma di metano ed etano. La sonda Huygens vi è atterrata nel 2005; Dragonfly ci volerà nel 2034.",
    facts: [{ label: "Diametro", value: "5.150 km" }, { label: "Orbita", value: "15,9 giorni" }, { label: "Temperatura", value: "−179 °C" }],
  },
  {
    id: "titania",
    name: "Titania",
    parent: "uranus",
    aliases: [],
    aKm: 435910,
    periodDays: 8.706,
    radiusKm: 789,
    color: "#b3a99f",
    description: "La luna più grande di Urano, con lunghi canyon che indicano un'antica espansione dell'interno.",
    facts: [{ label: "Diametro", value: "1.578 km" }, { label: "Orbita", value: "8,7 giorni" }],
  },
  {
    id: "oberon",
    name: "Oberon",
    parent: "uranus",
    aliases: [],
    aKm: 583520,
    periodDays: 13.463,
    radiusKm: 761,
    color: "#9b8c7e",
    description: "La luna più esterna tra le grandi di Urano, scura e piena di crateri, alcuni con il fondo coperto di materiale nero.",
    facts: [{ label: "Diametro", value: "1.523 km" }, { label: "Orbita", value: "13,5 giorni" }],
  },
  {
    id: "triton",
    name: "Tritone",
    parent: "neptune",
    aliases: ["Triton"],
    aKm: 354759,
    periodDays: -5.877,
    radiusKm: 1353,
    color: "#e4c8bb",
    description: "Gira attorno a Nettuno in senso contrario alla sua rotazione: è quasi certamente un oggetto della fascia di Kuiper catturato. Voyager 2 vi ha visto geyser di azoto.",
    facts: [{ label: "Diametro", value: "2.707 km" }, { label: "Orbita", value: "5,9 giorni, retrograda" }],
  },
  {
    id: "charon",
    name: "Caronte",
    parent: "pluto",
    aliases: ["Charon"],
    aKm: 19591,
    periodDays: 6.387,
    radiusKm: 606,
    color: "#958c84",
    description: "Grande la metà di Plutone: i due ruotano attorno a un baricentro esterno a entrambi e si mostrano sempre la stessa faccia. Il polo nord è macchiato di rosso.",
    facts: [{ label: "Diametro", value: "1.212 km" }, { label: "Orbita", value: "6,4 giorni" }],
  },
];

/** Direzione dei pianeti (RA/Dec di oggi) assegnata dal chiamante: le lune stanno accanto al pianeta. */
export function moonBodies(parentSky: Map<string, { ra: number; dec: number; distance: string }>): MoonBody[] {
  return MOON_SPECS.map((spec) => {
    const parent = parentSky.get(spec.parent);
    return {
      ...spec,
      kind: "moon",
      ra: parent?.ra ?? 0,
      dec: parent?.dec ?? 0,
      distance: `${nf(spec.aKm, 0)} km dal pianeta · ${parent?.distance ?? ""}`.replace(/ · $/, ""),
    };
  });
}

interface ProbeSpec {
  id: string;
  name: string;
  aliases: string[];
  /** Direzione eliocentrica (equatoriale J2000), ore e gradi. */
  ra: number;
  dec: number;
  /** Distanza dal Sole al 1° gennaio 2025 (UA) e velocità di allontanamento (UA/anno). */
  au2025: number;
  rate: number;
  link: string;
  description: string;
  facts: Fact[];
}

const PROBE_SPECS: ProbeSpec[] = [
  {
    id: "voyager1",
    name: "Voyager 1",
    aliases: ["Voyager"],
    ra: 17.22,
    dec: 12.1,
    au2025: 165.0,
    rate: 3.57,
    link: "https://science.nasa.gov/mission/voyager/",
    description: "Lanciata nel 1977, è l'oggetto costruito dall'uomo più lontano dalla Terra. Nel 2012 ha superato l'eliopausa ed è entrata nello spazio interstellare; porta con sé il Disco d'oro con suoni e immagini della Terra.",
    facts: [
      { label: "Lancio", value: "5 settembre 1977" },
      { label: "Velocità", value: "circa 17 km/s" },
      { label: "Segnale", value: "oltre 23 ore luce di viaggio" },
    ],
  },
  {
    id: "voyager2",
    name: "Voyager 2",
    aliases: ["Voyager"],
    ra: 20.15,
    dec: -60.3,
    au2025: 138.5,
    rate: 3.2,
    link: "https://science.nasa.gov/mission/voyager/",
    description: "L'unica sonda ad aver visitato Urano (1986) e Nettuno (1989). Dal 2018 si trova nello spazio interstellare, diretta verso il cielo australe.",
    facts: [
      { label: "Lancio", value: "20 agosto 1977" },
      { label: "Velocità", value: "circa 15 km/s" },
    ],
  },
  {
    id: "new-horizons",
    name: "New Horizons",
    aliases: [],
    ra: 19.45,
    dec: -20.4,
    au2025: 61.0,
    rate: 2.9,
    link: "https://science.nasa.gov/mission/new-horizons/",
    description: "Ha sorvolato Plutone nel 2015 e Arrokoth, un oggetto primordiale della fascia di Kuiper, nel 2019. Continua a esplorare la fascia di Kuiper.",
    facts: [
      { label: "Lancio", value: "19 gennaio 2006" },
      { label: "Velocità", value: "circa 14 km/s" },
    ],
  },
];

const YEAR_2025 = Date.UTC(2025, 0, 1);

export const PROBES: ProbeBody[] = PROBE_SPECS.map((spec) => {
  const years = (SOLAR_COMPUTED_AT.getTime() - YEAR_2025) / (365.25 * 86400000);
  const au = spec.au2025 + spec.rate * years;
  return {
    id: spec.id,
    name: spec.name,
    kind: "probe",
    aliases: spec.aliases,
    facts: [...spec.facts, { label: "Distanza dal Sole", value: `circa ${nf(au, 0)} UA` }],
    ra: spec.ra,
    dec: spec.dec,
    au,
    link: spec.link,
    description: spec.description,
    distance: `circa ${nf(au, 0)} UA · ${nf((au * 499) / 3600, 1)} ore luce`,
  };
});
