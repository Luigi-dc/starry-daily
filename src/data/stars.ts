import type { SkyObject } from "./objects";
import namedJson from "./stars-named.json";

/** Stelle con un nome proprio (HYG v4.1): servono a ricerca, etichette e schede. */
export interface NamedStar extends SkyObject {
  kind: "star";
  /** Indice della stella in stars3d.json. */
  index: number;
  ly: number;
  spectral: string;
  /** Magnitudine apparente vista dalla Terra. */
  mag: number;
  aliases: string[];
}

const CLASS_LABEL: Record<string, string> = {
  O: "una stella blu caldissima di classe O",
  B: "una stella azzurra di classe B",
  A: "una stella bianca di classe A",
  F: "una stella bianco-gialla di classe F",
  G: "una stella gialla di classe G, come il Sole",
  K: "una stella arancione di classe K",
  M: "una stella rossa di classe M",
  D: "una nana bianca, il nucleo spento di una stella",
};

const nf = (value: number, digits = 0) =>
  value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function describe(name: string, ly: number, spectral: string): string {
  const cls = CLASS_LABEL[spectral.charAt(0)] ?? "una stella";
  const giant = /I{1,3}(?!V)|Ia|Ib/.test(spectral) ? " È una gigante o supergigante: molto più grande e luminosa del Sole." : "";
  const light = ly < 100 ? ` La sua luce impiega ${nf(ly, 1)} anni ad arrivare fino a noi.` : "";
  return `${name} è ${cls} (tipo spettrale ${spectral || "non noto"}).${giant}${light}`;
}

const raw = (namedJson as unknown as { names: Array<[number, string, number, string, number, number, number]> }).names;

export const NAMED_STARS: NamedStar[] = raw.map(([index, name, ly, spectral, ra, dec, mag]) => ({
  id: `star-${index}`,
  name,
  kind: "star",
  index,
  ly,
  spectral,
  mag,
  aliases: [],
  ra,
  dec,
  distance: `${nf(ly, ly < 100 ? 1 : 0)} anni luce`,
  description: describe(name, ly, spectral),
}));
