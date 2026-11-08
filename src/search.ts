import { KIND_LABEL, type SkyObject } from "./data/objects";

/** Nomi alternativi (cataloghi, soprannomi) per la ricerca degli oggetti del cielo profondo. */
const ALIASES: Record<string, string[]> = {
  orion: ["M42", "NGC 1976", "Grande Nebulosa di Orione", "Orione"],
  andromeda: ["M31", "NGC 224", "Andromeda"],
  pillars: ["M16", "Nebulosa Aquila", "Eagle Nebula"],
  carina: ["NGC 3372", "Eta Carinae"],
  crab: ["M1", "NGC 1952"],
  whirlpool: ["M51", "NGC 5194"],
  sombrero: ["M104", "NGC 4594"],
  ring: ["M57", "NGC 6720"],
  helix: ["NGC 7293", "Occhio di Dio"],
  tarantula: ["NGC 2070", "30 Doradus"],
  pleiades: ["M45", "Sette Sorelle"],
  horsehead: ["B33", "Barnard 33"],
  hudf: ["HUDF", "Ultra Deep Field"],
  "centaurus-a": ["NGC 5128", "Cen A"],
  "cassiopeia-a": ["Cas A", "SN 1680"],
  m83: ["NGC 5236", "Girandola del Sud", "Southern Pinwheel"],
  antennae: ["NGC 4038", "NGC 4039"],
  "galactic-center": ["Sgr A*", "Sagittarius A*", "Via Lattea", "Milky Way"],
};

export interface SearchEntry {
  object: SkyObject;
  name: string;
  aliases: string[];
  kind: string;
  words: string[];
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function buildIndex(objects: SkyObject[]): SearchEntry[] {
  return objects.map((object) => {
    const extra = (object as { aliases?: string[] }).aliases ?? ALIASES[object.id] ?? [];
    const name = normalize(object.name);
    const aliases = extra.map(normalize);
    const kind = normalize(KIND_LABEL[object.kind]);
    return {
      object,
      name,
      aliases,
      kind,
      words: [...name.split(" "), ...aliases.flatMap((alias) => alias.split(" ")), ...kind.split(" ")],
    };
  });
}

/**
 * Filtra l'indice: ogni parola cercata deve essere l'inizio di una parola dell'oggetto
 * (nome, aliase, tipo). I risultati sono ordinati per pertinenza.
 */
export function searchSky(index: SearchEntry[], query: string, limit = 6): SkyObject[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);

  const found: Array<{ object: SkyObject; score: number; name: string }> = [];

  for (const entry of index) {
    if (!tokens.every((token) => entry.words.some((word) => word.startsWith(token)))) continue;

    let score = 5;
    if (entry.name === q) score = 0;
    else if (entry.name.startsWith(q)) score = 1;
    else if (entry.aliases.includes(q)) score = 2;
    else if (entry.aliases.some((alias) => alias.startsWith(q))) score = 3;
    else if (entry.name.includes(q)) score = 4;

    found.push({ object: entry.object, score, name: entry.name });
  }

  found.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "it"));
  return found.slice(0, limit).map((entry) => entry.object);
}
