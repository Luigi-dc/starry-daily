import type { SkyObject } from "./objects";

/**
 * Regioni dello spazio che non sono un singolo oggetto: fasce del sistema solare, la nostra galassia,
 * il Gruppo Locale, l'universo osservabile. Servono a ricerca, etichette e scorciatoie di scala.
 */
export interface Region extends SkyObject {
  kind: "structure";
  aliases: string[];
  /** Distanza dal Sole del punto in cui si mette l'etichetta (anni luce). */
  ly: number;
  /** Distanza della camera quando ci si vola sopra (anni luce). */
  viewLy: number;
  /** L'etichetta compare quando la camera è più vicina di 50 × labelLy e più lontana di minLy. */
  labelLy: number;
  minLy: number;
}

const AU = 1.58125074e-5;

export const REGIONS: Region[] = [
  {
    id: "asteroid-belt",
    name: "Fascia degli asteroidi",
    kind: "structure",
    aliases: ["Main belt", "asteroidi"],
    ra: 18,
    dec: -23.4,
    ly: 2.8 * AU,
    viewLy: 9 * AU,
    labelLy: 1.2 * AU,
    minLy: 3 * AU,
    distance: "tra 2,1 e 3,3 UA dal Sole",
    description:
      "Milioni di rocce tra Marte e Giove, avanzi della formazione dei pianeti: la gravità di Giove ha impedito che si unissero. Messe insieme farebbero appena il 3% della massa della Luna, e metà della massa sta in Cerere, Vesta, Pallade e Igea.",
  },
  {
    id: "kuiper-belt",
    name: "Fascia di Kuiper",
    kind: "structure",
    aliases: ["Kuiper Belt", "transnettuniani"],
    ra: 6,
    dec: 23.4,
    ly: 44 * AU,
    viewLy: 140 * AU,
    labelLy: 18 * AU,
    minLy: 50 * AU,
    distance: "tra 30 e 50 UA dal Sole",
    description:
      "Un anello di corpi ghiacciati oltre Nettuno, da cui vengono molte comete di breve periodo. Ospita Plutone, Haumea, Makemake e migliaia di oggetti più piccoli; New Horizons ne ha visitato uno, Arrokoth, nel 2019.",
  },
  {
    id: "oort-cloud",
    name: "Nube di Oort",
    kind: "structure",
    aliases: ["Oort Cloud", "comete di lungo periodo"],
    ra: 2,
    dec: 55,
    ly: 0.9,
    viewLy: 4,
    labelLy: 0.25,
    minLy: 0.4,
    distance: "da circa 2.000 a 100.000 UA dal Sole",
    description:
      "Un guscio sferico ipotetico di miliardi di nuclei di cometa che avvolge il sistema solare fino a quasi metà strada dalla stella più vicina. Non è mai stato osservato direttamente: lo si deduce dalle orbite delle comete di lungo periodo.",
  },
  {
    id: "milky-way",
    name: "Via Lattea",
    kind: "structure",
    aliases: ["Milky Way", "la nostra galassia", "galassia"],
    ra: 17.761,
    dec: -28.94,
    ly: 26700,
    viewLy: 170000,
    labelLy: 1.5e6,
    minLy: 90000,
    distance: "il Sole è a circa 26.700 anni luce dal centro",
    description:
      "La nostra galassia: una spirale barrata larga circa 100.000 anni luce con 100–400 miliardi di stelle. Il Sole sta nello Sperone di Orione, tra il braccio del Sagittario e quello di Perseo, e compie un giro attorno al centro ogni 230 milioni di anni. Il disegno è un modello: dall'interno non possiamo fotografarla tutta.",
  },
  {
    id: "local-group",
    name: "Gruppo Locale",
    kind: "structure",
    aliases: ["Local Group"],
    ra: 0.71,
    dec: 41,
    ly: 1.25e6,
    viewLy: 9e6,
    labelLy: 4e7,
    minLy: 5e6,
    distance: "circa 10 milioni di anni luce di diametro",
    description:
      "Il gruppo di oltre 80 galassie legate dalla gravità a cui appartiene la Via Lattea. È dominato da Andromeda e dalla Via Lattea, seguite dalla Galassia del Triangolo; tutte le altre sono nane.",
  },
  {
    id: "observable-universe",
    name: "Universo osservabile",
    kind: "structure",
    aliases: ["Observable Universe", "radiazione cosmica di fondo", "CMB", "Big Bang"],
    ra: 12,
    dec: 62,
    ly: 46.5e9,
    viewLy: 1.9e11,
    labelLy: 1e12,
    minLy: 4e10,
    distance: "raggio di circa 46,5 miliardi di anni luce",
    description:
      "Tutto ciò da cui la luce ha avuto il tempo di raggiungerci in 13,8 miliardi di anni: per l'espansione dello spazio, oggi il bordo si trova a circa 46,5 miliardi di anni luce. Oltre c'è altro universo, ma non possiamo vederlo. Il guscio colorato rappresenta la radiazione cosmica di fondo, la luce più antica.",
  },
];
