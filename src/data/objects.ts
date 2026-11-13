export type Kind =
  | "nebula"
  | "galaxy"
  | "cluster"
  | "remnant"
  | "blackhole"
  | "planet"
  | "moon"
  | "sun"
  | "dwarf"
  | "asteroid"
  | "comet"
  | "star"
  | "probe"
  | "structure";

export interface SkyObject {
  id: string;
  name: string;
  kind: Kind;
  /** Ascensione retta in ore (J2000). */
  ra: number;
  /** Declinazione in gradi (J2000). */
  dec: number;
  distance: string;
  description: string;
}

export const KIND_LABEL: Record<Kind, string> = {
  nebula: "Nebulosa",
  galaxy: "Galassia",
  cluster: "Ammasso stellare",
  remnant: "Resto di supernova",
  blackhole: "Buco nero supermassiccio",
  planet: "Pianeta",
  moon: "Satellite",
  sun: "Stella",
  dwarf: "Pianeta nano",
  asteroid: "Asteroide",
  comet: "Cometa",
  star: "Stella",
  probe: "Sonda spaziale",
  structure: "Struttura cosmica",
};

export const OBJECTS: SkyObject[] = [
  {
    id: "orion",
    name: "Nebulosa di Orione",
    kind: "nebula",
    ra: 5.5881,
    dec: -5.3911,
    distance: "1.344 anni luce",
    description:
      "La nursery stellare più vicina e studiata del cielo: un banco di gas incandescente illuminato dal Trapezio, il giovane ammasso che ospita al suo centro. Gli scatti nell'infrarosso hanno rivelato dischi protoplanetari e getti di stelle appena nate.",
  },
  {
    id: "andromeda",
    name: "Galassia di Andromeda",
    kind: "galaxy",
    ra: 0.7123,
    dec: 41.2692,
    distance: "2,5 milioni di anni luce",
    description:
      "La grande spirale più vicina alla Via Lattea, l'unica galassia visibile a occhio nudo dall'emisfero nord. Il mosaico ad alta definizione di Hubble ne mostra il doppio nucleo e le nubi di polveri con un dettaglio mai raggiunto prima.",
  },
  {
    id: "pillars",
    name: "Pilastri della Creazione",
    kind: "nebula",
    ra: 18.3133,
    dec: -13.8167,
    distance: "6.500 anni luce",
    description:
      "Torri di gas e polvere nella Nebulosa Aquila, alte alcuni anni luce, dove il gas collassa in nuove stelle. Le immagini del 1995 e del 2014 sono tra le più celebri dell'astronomia moderna e hanno misurato l'erosione dei pilastri da parte del vento stellare.",
  },
  {
    id: "carina",
    name: "Nebulosa Carena",
    kind: "nebula",
    ra: 10.7522,
    dec: -59.8667,
    distance: "7.500 anni luce",
    description:
      "Una delle regioni di formazione stellare più estese della Via Lattea, sede di Eta Carinae: un sistema stellare instabile tra i più massicci conosciuti, circondato da filamenti e globuli di polvere.",
  },
  {
    id: "crab",
    name: "Nebulosa del Granchio",
    kind: "remnant",
    ra: 5.5755,
    dec: 22.0145,
    distance: "6.500 anni luce",
    description:
      "Il resto della supernova osservata nel 1054: una ragnatela di gas in espansione alimentata da una pulsar che ruota circa trenta volte al secondo. Le immagini combinano i dati ottici con quelli X per seguire la struttura del campo magnetico.",
  },
  {
    id: "whirlpool",
    name: "Galassia Vortice",
    kind: "galaxy",
    ra: 13.498,
    dec: 47.1952,
    distance: "23 milioni di anni luce",
    description:
      "Una spirale vista di faccia che interagisce con la compagna NGC 5195. Le braccia mostrano nodi luminosi di formazione stellare e sottili strisce di polvere in silhouette sul disco.",
  },
  {
    id: "sombrero",
    name: "Galassia Sombrero",
    kind: "galaxy",
    ra: 12.6667,
    dec: -11.623,
    distance: "31 milioni di anni luce",
    description:
      "Un enorme bulbo luminoso tagliato da una banda di polveri che la fa somigliare a un cappello. Vista quasi di profilo, è uno dei migliori esempi di galassia a disco con un alone esteso e un buco nero centrale molto massiccio.",
  },
  {
    id: "ring",
    name: "Nebulosa Anello",
    kind: "nebula",
    ra: 18.8931,
    dec: 33.0292,
    distance: "2.600 anni luce",
    description:
      "Un guscio di gas espulso da una stella morente simile al Sole, con una nana bianca al centro che ne eccita l'idrogeno. La forma ad anello è l'effetto prospettico di una struttura cilindrica vista di fronte.",
  },
  {
    id: "helix",
    name: "Nebulosa Elicoidale",
    kind: "nebula",
    ra: 22.4939,
    dec: -20.8372,
    distance: "650 anni luce",
    description:
      "Una delle nebulose planetarie più vicine, con filamenti che formano il caratteristico occhio cosmico. Le strutture a cometa della polvere indicano il moto del gas espulso dalla stella centrale.",
  },
  {
    id: "tarantula",
    name: "Nebulosa Tarantola",
    kind: "nebula",
    ra: 5.6439,
    dec: -69.095,
    distance: "160.000 anni luce (Grande Nube di Magellano)",
    description:
      "La regione di formazione stellare più attiva del Gruppo Locale, nella Grande Nube di Magellano. Ospita stelle fra le più massicce mai osservate, con venti e radiazioni che scavano cavità nel gas.",
  },
  {
    id: "pleiades",
    name: "Pleiadi",
    kind: "cluster",
    ra: 3.79,
    dec: 24.1167,
    distance: "444 anni luce",
    description:
      "Un giovane ammasso aperto di stelle blu avvolte da una tenue nebulosità riflessa, visibile a occhio nudo. L'osservazione infrarossa mostra la polvere che le circonda e le stelle di fondo.",
  },
  {
    id: "horsehead",
    name: "Nebulosa Testa di Cavallo",
    kind: "nebula",
    ra: 5.6833,
    dec: -2.4583,
    distance: "1.500 anni luce",
    description:
      "Una nube di polvere scura in silhouette contro l'idrogeno luminoso della Nebulosa Fiamma, nella cintura di Orione. È una delle sagome più riconoscibili del cielo profondo.",
  },
  {
    id: "hudf",
    name: "Hubble Ultra Deep Field",
    kind: "galaxy",
    ra: 3.5439,
    dec: -27.7914,
    distance: "fino a 13 miliardi di anni luce",
    description:
      "Una porzione di cielo apparentemente vuota, osservata per giorni interi: ha rivelato migliaia di galassie di epoche diverse, alcune formatesi poche centinaia di milioni di anni dopo il Big Bang.",
  },
  {
    id: "centaurus-a",
    name: "Centaurus A",
    kind: "galaxy",
    ra: 13.4244,
    dec: -43.0192,
    distance: "13 milioni di anni luce",
    description:
      "Una galassia ellittica sconvolta da una fusione, attraversata da una spessa banda di polveri. Dal buco nero centrale partono getti di materia osservabili alle onde radio e ai raggi X.",
  },
  {
    id: "cassiopeia-a",
    name: "Cassiopeia A",
    kind: "remnant",
    ra: 23.3906,
    dec: 58.8111,
    distance: "11.000 anni luce",
    description:
      "Il resto di supernova più brillante del cielo alle onde radio: i detriti di una stella esplosa circa 340 anni fa, oggi un guscio caldo in espansione.",
  },
  {
    id: "m83",
    name: "Galassia Girandola del Sud",
    kind: "galaxy",
    ra: 13.6167,
    dec: -29.8658,
    distance: "15 milioni di anni luce",
    description:
      "Una spirale barrata con un nucleo luminoso e braccia punteggiate di regioni rosse di idrogeno ionizzato, dove nascono sciami di stelle giovani.",
  },
  {
    id: "antennae",
    name: "Galassie Antenne",
    kind: "galaxy",
    ra: 12.0317,
    dec: -18.8833,
    distance: "45 milioni di anni luce",
    description:
      "Due galassie in collisione: le forze mareali hanno strappato stelle e gas in lunghe code che ricordano le antenne di un insetto. È una anteprima di ciò che accadrà quando la Via Lattea incontrerà Andromeda.",
  },
  {
    id: "galactic-center",
    name: "Centro della Via Lattea",
    kind: "blackhole",
    ra: 17.7611,
    dec: -29.0078,
    distance: "26.000 anni luce",
    description:
      "Il cuore della nostra galassia, dove il buco nero supermassiccio Sagittarius A* (circa quattro milioni di masse solari) è circondato da gas turbolento, resti di supernova e stelle giovani.",
  },
];
