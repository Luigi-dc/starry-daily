// Scarica il database stellare HYG v4.1 (astronexus, licenza CC BY-SA 4.0) e produce
// src/data/stars3d.json: le stelle visibili a occhio nudo e tutte quelle entro 50 anni luce,
// con posizione 3D reale, e src/data/stars-named.json con le stelle che hanno un nome
// (usato dalla ricerca senza caricare tutto il catalogo). Uso: node scripts/fetch-stars3d.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";

const URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const OUT = path.resolve("src/data/stars3d.json");
const OUT_NAMES = path.resolve("src/data/stars-named.json");
/** Magnitudine apparente limite e raggio (parsec) entro cui si tengono tutte le stelle. */
const MAG_LIMIT = 6.5;
const NEAR_PC = 15.33; // 50 anni luce

/** Nomi italiani delle stelle più note (il catalogo usa i nomi IAU inglesi). */
const ITALIAN = {
  Sirius: "Sirio",
  Canopus: "Canopo",
  "Rigil Kentaurus": "Alfa Centauri",
  Arcturus: "Arturo",
  Capella: "Capella",
  Rigel: "Rigel",
  Procyon: "Procione",
  Betelgeuse: "Betelgeuse",
  Achernar: "Achernar",
  Hadar: "Hadar",
  Altair: "Altair",
  Acrux: "Acrux",
  Aldebaran: "Aldebaran",
  Antares: "Antares",
  Spica: "Spica",
  Pollux: "Polluce",
  Fomalhaut: "Fomalhaut",
  Deneb: "Deneb",
  Mimosa: "Mimosa",
  Regulus: "Regolo",
  Adhara: "Adhara",
  Castor: "Castore",
  Polaris: "Stella Polare",
  Vega: "Vega",
  "Proxima Centauri": "Proxima Centauri",
  "Barnard's Star": "Stella di Barnard",
  Toliman: "Alfa Centauri B",
  Alnilam: "Alnilam",
  Alnitak: "Alnitak",
  Mintaka: "Mintaka",
  Bellatrix: "Bellatrix",
  Saiph: "Saiph",
  Mira: "Mira",
  Alcyone: "Alcione",
  Algol: "Algol",
  Mizar: "Mizar",
  Dubhe: "Dubhe",
  Wolf_359: "Wolf 359",
};

const round = (value, digits) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Divide una riga CSV rispettando le virgolette. */
function splitCsv(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
}

const res = await fetch(URL, { headers: { "User-Agent": "starry-daily/1.0" } });
if (!res.ok) throw new Error(`HYG: HTTP ${res.status}`);
const lines = (await res.text()).split(/\r?\n/);
const header = splitCsv(lines[0]);
const col = Object.fromEntries(header.map((name, i) => [name, i]));

const stars = [];
const names = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const row = splitCsv(lines[i]);
  const id = Number(row[col.id]);
  if (id === 0) continue; // il Sole è disegnato a parte
  const dist = Number(row[col.dist]);
  const mag = Number(row[col.mag]);
  // distanza 100000 = parallasse non misurata
  if (!Number.isFinite(dist) || dist <= 0 || dist >= 100000) continue;
  if (!(mag <= MAG_LIMIT || dist <= NEAR_PC)) continue;

  const x = Number(row[col.x]);
  const y = Number(row[col.y]);
  const z = Number(row[col.z]);
  const absmag = Number(row[col.absmag]);
  const ci = Number(row[col.ci] || 0.6);
  const index = stars.length;
  stars.push([round(x, 3), round(y, 3), round(z, 3), round(absmag, 2), round(Number.isFinite(ci) ? ci : 0.6, 2)]);

  const proper = row[col.proper];
  if (proper && (mag <= 2.6 || dist <= 5.5 || ITALIAN[proper])) {
    const ra = Number(row[col.ra]);
    const dec = Number(row[col.dec]);
    names.push([index, ITALIAN[proper] ?? proper, round(dist * 3.26156, 2), row[col.spect] || "", round(ra, 4), round(dec, 3), round(mag, 2)]);
  }
}

const source = "HYG Database v4.1 (astronexus), CC BY-SA 4.0";
const fetchedAt = new Date().toISOString();
// stelle: [x, y, z] in parsec (equatoriale J2000), magnitudine assoluta, indice B-V
await writeFile(OUT, JSON.stringify({ source, fetchedAt, stars }));
// nomi: [indice nella lista delle stelle, nome, distanza in anni luce, tipo spettrale, RA in ore, Dec in gradi, magnitudine apparente]
await writeFile(OUT_NAMES, JSON.stringify({ source, fetchedAt, names }));
console.log(`stelle: ${stars.length} · con nome: ${names.length} · file: ${OUT}`);
