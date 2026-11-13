import type { Kind, SkyObject } from "./objects";

/**
 * Galassie del Gruppo Locale e dintorni, ammassi e grandi strutture dell'universo.
 * Posizioni J2000 e distanze da NED / letteratura recente, arrotondate.
 * Per gli oggetti lontanissimi la distanza è quella «comovente» (dove si trovano oggi),
 * che è quella da usare in una mappa 3D dell'universo.
 */
export interface CosmicObject extends SkyObject {
  kind: Extract<Kind, "galaxy" | "structure">;
  aliases: string[];
  /** Distanza in anni luce. */
  ly: number;
  /** Diametro in anni luce (per disegnarlo in scala). */
  sizeLy: number;
  /** Forma di massima del disegno. */
  shape: "spiral" | "elliptical" | "irregular" | "dwarf" | "cluster" | "wall" | "void";
  /** Gruppo di appartenenza, per i filtri di scala. */
  group: "local" | "nearby" | "cosmic";
}

type Spec = Omit<CosmicObject, "distance"> & { distance?: string };

const nf = (value: number, digits = 0) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** «160.000 anni luce», «2,5 milioni di anni luce», «13,8 miliardi di anni luce». */
export function lyLabel(ly: number): string {
  if (ly >= 1e9) return `${nf(ly / 1e9, ly < 1e10 ? 1 : 0)} miliardi di anni luce`;
  if (ly >= 1e6) return `${nf(ly / 1e6, ly < 1e7 ? 1 : 0)} milioni di anni luce`;
  if (ly >= 10) return `${nf(ly)} anni luce`;
  return `${nf(ly, 2)} anni luce`;
}

const SPECS: Spec[] = [
  // ---- Gruppo Locale ----
  { id: "lmc", name: "Grande Nube di Magellano", kind: "galaxy", aliases: ["LMC", "Large Magellanic Cloud"], ra: 5.39, dec: -69.76, ly: 163000, sizeLy: 32000, shape: "irregular", group: "local",
    description: "La galassia satellite più grande della Via Lattea, visibile a occhio nudo dall'emisfero australe. Ospita la Nebulosa Tarantola, la regione di formazione stellare più attiva del Gruppo Locale." },
  { id: "smc", name: "Piccola Nube di Magellano", kind: "galaxy", aliases: ["SMC", "Small Magellanic Cloud"], ra: 0.88, dec: -72.83, ly: 200000, sizeLy: 19000, shape: "irregular", group: "local",
    description: "Galassia nana irregolare legata alla Grande Nube da un ponte di gas; entrambe stanno cadendo verso la Via Lattea." },
  { id: "sgr-dwarf", name: "Nana del Sagittario", kind: "galaxy", aliases: ["Sagittarius Dwarf", "SagDEG"], ra: 18.92, dec: -30.48, ly: 70000, sizeLy: 10000, shape: "dwarf", group: "local",
    description: "Una galassia nana che la Via Lattea sta facendo a pezzi: le sue stelle formano una lunga corrente che avvolge la nostra galassia." },
  { id: "draco-dwarf", name: "Nana del Drago", kind: "galaxy", aliases: ["Draco Dwarf"], ra: 17.33, dec: 57.92, ly: 260000, sizeLy: 3000, shape: "dwarf", group: "local",
    description: "Una delle galassie più dominate dalla materia oscura che si conoscano: le stelle sono solo una piccola frazione della sua massa." },
  { id: "umi-dwarf", name: "Nana dell'Orsa Minore", kind: "galaxy", aliases: ["Ursa Minor Dwarf"], ra: 15.15, dec: 67.22, ly: 200000, sizeLy: 2000, shape: "dwarf", group: "local",
    description: "Galassia satellite antichissima: quasi tutte le sue stelle hanno più di 10 miliardi di anni." },
  { id: "sculptor-dwarf", name: "Nana dello Scultore", kind: "galaxy", aliases: ["Sculptor Dwarf"], ra: 1.0, dec: -33.71, ly: 290000, sizeLy: 3000, shape: "dwarf", group: "local",
    description: "La prima galassia nana sferoidale scoperta (1937), satellite della Via Lattea." },
  { id: "fornax-dwarf", name: "Nana della Fornace", kind: "galaxy", aliases: ["Fornax Dwarf"], ra: 2.67, dec: -34.45, ly: 460000, sizeLy: 6000, shape: "dwarf", group: "local",
    description: "Galassia satellite con sei ammassi globulari propri, uno dei quali visibile anche con piccoli telescopi." },
  { id: "carina-dwarf", name: "Nana della Carena", kind: "galaxy", aliases: ["Carina Dwarf"], ra: 6.69, dec: -50.97, ly: 330000, sizeLy: 2000, shape: "dwarf", group: "local",
    description: "Galassia nana che ha formato stelle a ondate separate da miliardi di anni di quiete." },
  { id: "leo-i", name: "Leo I", kind: "galaxy", aliases: ["Leo I dwarf"], ra: 10.14, dec: 12.31, ly: 820000, sizeLy: 2000, shape: "dwarf", group: "local",
    description: "Una delle galassie satellite più lontane della Via Lattea, nascosta nel bagliore della stella Regolo." },
  { id: "ngc6822", name: "Galassia di Barnard", kind: "galaxy", aliases: ["NGC 6822"], ra: 19.75, dec: -14.8, ly: 1600000, sizeLy: 7000, shape: "irregular", group: "local",
    description: "Galassia irregolare del Gruppo Locale con nebulose luminose, simile alla Piccola Nube di Magellano." },
  { id: "ic1613", name: "IC 1613", kind: "galaxy", aliases: [], ra: 1.08, dec: 2.12, ly: 2400000, sizeLy: 10000, shape: "irregular", group: "local",
    description: "Galassia nana irregolare quasi priva di polvere: per questo è un laboratorio ideale per misurare le distanze cosmiche." },
  { id: "m32", name: "M32", kind: "galaxy", aliases: ["NGC 221"], ra: 0.711, dec: 40.87, ly: 2490000, sizeLy: 6500, shape: "elliptical", group: "local",
    description: "Ellittica compatta satellite di Andromeda, forse il nucleo superstite di una spirale più grande." },
  { id: "m110", name: "M110", kind: "galaxy", aliases: ["NGC 205"], ra: 0.673, dec: 41.69, ly: 2690000, sizeLy: 17000, shape: "elliptical", group: "local",
    description: "Galassia ellittica nana satellite di Andromeda." },
  { id: "m33", name: "Galassia del Triangolo", kind: "galaxy", aliases: ["M33", "NGC 598", "Triangulum"], ra: 1.564, dec: 30.66, ly: 2730000, sizeLy: 61000, shape: "spiral", group: "local",
    description: "La terza galassia del Gruppo Locale per dimensioni, una spirale ricca di nebulose come NGC 604, una delle più grandi regioni di formazione stellare conosciute." },
  { id: "wlm", name: "WLM", kind: "galaxy", aliases: ["Wolf-Lundmark-Melotte"], ra: 0.03, dec: -15.46, ly: 3000000, sizeLy: 8000, shape: "irregular", group: "local",
    description: "Galassia nana isolata ai margini del Gruppo Locale, che non ha mai interagito con le grandi spirali." },

  // ---- galassie vicine ----
  { id: "m81", name: "Galassia di Bode", kind: "galaxy", aliases: ["M81", "NGC 3031"], ra: 9.93, dec: 69.07, ly: 11800000, sizeLy: 90000, shape: "spiral", group: "nearby",
    description: "Una spirale «da manuale» nell'Orsa Maggiore, che con la vicina M82 forma uno dei gruppi di galassie più vicini." },
  { id: "m82", name: "Galassia Sigaro", kind: "galaxy", aliases: ["M82", "NGC 3034", "Cigar"], ra: 9.93, dec: 69.68, ly: 11500000, sizeLy: 37000, shape: "irregular", group: "nearby",
    description: "Una galassia «starburst»: l'incontro ravvicinato con M81 ha acceso una formazione stellare violenta che soffia venti di gas fuori dal disco." },
  { id: "m101", name: "Galassia Girandola", kind: "galaxy", aliases: ["M101", "NGC 5457", "Pinwheel"], ra: 14.05, dec: 54.35, ly: 20900000, sizeLy: 170000, shape: "spiral", group: "nearby",
    description: "Grande spirale vista di faccia, quasi il doppio della Via Lattea." },
  { id: "m87", name: "M87", kind: "galaxy", aliases: ["Virgo A", "NGC 4486"], ra: 12.51, dec: 12.39, ly: 53500000, sizeLy: 240000, shape: "elliptical", group: "nearby",
    description: "Ellittica gigante al centro dell'ammasso della Vergine. Il suo buco nero di 6,5 miliardi di masse solari è stato il primo fotografato (Event Horizon Telescope, 2019)." },
  { id: "ngc1300", name: "NGC 1300", kind: "galaxy", aliases: [], ra: 3.33, dec: -19.41, ly: 61000000, sizeLy: 110000, shape: "spiral", group: "nearby",
    description: "Il prototipo delle spirali barrate, celebre per le immagini di Hubble." },

  // ---- strutture su grande scala ----
  { id: "virgo-cluster", name: "Ammasso della Vergine", kind: "structure", aliases: ["Virgo Cluster"], ra: 12.45, dec: 12.7, ly: 54000000, sizeLy: 15000000, shape: "cluster", group: "cosmic",
    description: "L'ammasso di galassie più vicino: circa 1.500 galassie. La sua gravità rallenta l'allontanamento del Gruppo Locale dovuto all'espansione." },
  { id: "fornax-cluster", name: "Ammasso della Fornace", kind: "structure", aliases: ["Fornax Cluster"], ra: 3.64, dec: -35.45, ly: 62000000, sizeLy: 6000000, shape: "cluster", group: "cosmic",
    description: "Il secondo ammasso ricco più vicino, nell'emisfero australe." },
  { id: "great-attractor", name: "Grande Attrattore", kind: "structure", aliases: ["Great Attractor", "Ammasso della Squadra", "Norma Cluster"], ra: 16.25, dec: -60.9, ly: 220000000, sizeLy: 30000000, shape: "cluster", group: "cosmic",
    description: "Una concentrazione di massa nascosta dietro il disco della Via Lattea, verso cui scivolano la nostra galassia e migliaia di altre." },
  { id: "laniakea", name: "Superammasso Laniakea", kind: "structure", aliases: ["Laniakea"], ra: 16.25, dec: -60.9, ly: 250000000, sizeLy: 520000000, shape: "cluster", group: "cosmic",
    description: "«Cielo immenso» in hawaiano: il superammasso di circa 100.000 galassie di cui facciamo parte, definito nel 2014 dai moti delle galassie." },
  { id: "perseus-cluster", name: "Ammasso di Perseo", kind: "structure", aliases: ["Perseus Cluster", "Abell 426"], ra: 3.33, dec: 41.5, ly: 240000000, sizeLy: 12000000, shape: "cluster", group: "cosmic",
    description: "Uno degli oggetti più luminosi del cielo nei raggi X; il suo gas caldo vibra di onde sonore 57 ottave sotto il Do centrale." },
  { id: "coma-cluster", name: "Ammasso della Chioma", kind: "structure", aliases: ["Coma Cluster", "Abell 1656"], ra: 12.99, dec: 27.98, ly: 321000000, sizeLy: 20000000, shape: "cluster", group: "cosmic",
    description: "Oltre 3.000 galassie. Studiandolo nel 1933 Fritz Zwicky dedusse per primo l'esistenza della materia oscura." },
  { id: "shapley", name: "Superammasso di Shapley", kind: "structure", aliases: ["Shapley Supercluster"], ra: 13.4, dec: -31, ly: 650000000, sizeLy: 400000000, shape: "cluster", group: "cosmic",
    description: "La più grande concentrazione di galassie nell'universo vicino, oltre il Grande Attrattore." },
  { id: "bootes-void", name: "Grande Vuoto di Boote", kind: "structure", aliases: ["Bootes Void"], ra: 14.83, dec: 46, ly: 700000000, sizeLy: 330000000, shape: "void", group: "cosmic",
    description: "Una bolla quasi vuota larga 330 milioni di anni luce: contiene solo una sessantina di galassie dove ce ne aspetteremmo migliaia." },
  { id: "sloan-wall", name: "Grande Muraglia di Sloan", kind: "structure", aliases: ["Sloan Great Wall"], ra: 12.5, dec: 2, ly: 1000000000, sizeLy: 1380000000, shape: "wall", group: "cosmic",
    description: "Un filamento di galassie lungo quasi 1,4 miliardi di anni luce, scoperto nel 2003 dalla Sloan Digital Sky Survey." },
  { id: "3c273", name: "Quasar 3C 273", kind: "galaxy", aliases: ["3C 273"], ra: 12.49, dec: 2.05, ly: 2400000000, sizeLy: 200000, shape: "elliptical", group: "cosmic",
    description: "Il primo quasar identificato (1963): il nucleo di una galassia alimentato da un buco nero di quasi un miliardo di masse solari, migliaia di volte più luminoso della Via Lattea." },
  { id: "bullet-cluster", name: "Ammasso Proiettile", kind: "structure", aliases: ["Bullet Cluster", "1E 0657-56"], ra: 6.98, dec: -55.95, ly: 4300000000, sizeLy: 10000000, shape: "cluster", group: "cosmic",
    description: "Due ammassi che si sono attraversati: il gas si è fermato nello scontro, la materia oscura no. È una delle prove più dirette della sua esistenza." },
  { id: "hercb-wall", name: "Grande Muraglia Ercole–Corona Boreale", kind: "structure", aliases: ["Hercules-Corona Borealis Great Wall"], ra: 16, dec: 27, ly: 15000000000, sizeLy: 10000000000, shape: "wall", group: "cosmic",
    description: "La struttura più grande proposta finora, lunga circa 10 miliardi di anni luce, individuata dalla distribuzione dei lampi gamma." },
  { id: "jades-z14", name: "JADES-GS-z14-0", kind: "galaxy", aliases: ["galassia più lontana"], ra: 3.55, dec: -27.87, ly: 33800000000, sizeLy: 1600, shape: "dwarf", group: "cosmic",
    description: "Tra le galassie più lontane mai confermate (Webb, 2024): la vediamo com'era 290 milioni di anni dopo il Big Bang. Oggi si trova a circa 34 miliardi di anni luce." },
];

export const COSMIC_OBJECTS: CosmicObject[] = SPECS.map((spec) => ({ ...spec, distance: spec.distance ?? lyLabel(spec.ly) }));

/** Raggio dell'universo osservabile (distanza comovente, anni luce). */
export const OBSERVABLE_UNIVERSE_LY = 46.5e9;
