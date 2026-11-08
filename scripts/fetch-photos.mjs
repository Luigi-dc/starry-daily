// Scarica immagini reali di telescopi spaziali dalla NASA Image & Video Library.
// Uso: node scripts/fetch-photos.mjs
import { mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT_IMG = path.resolve("public/photos");
const OUT_DATA = path.resolve("src/data/photos.json");
const API = "https://images-api.nasa.gov/search";
const ASSETS = "https://images-assets.nasa.gov/image";

// Immagini scelte a mano (verificate): id locale -> NASA ID.
const PICK = {
  andromeda: "GSFC_20171208_Archive_e000833",
  pillars: "GSFC_20171208_Archive_e000842",
  orion: "PIA25434",
  hudf: "GSFC_20171208_Archive_e001061",
  "cassiopeia-a": "GSFC_20171208_Archive_e002183",
  sombrero: "PIA15226",
  "galactic-center": "PIA03653",
  ring: "GSFC_20171208_Archive_e001464",
  "centaurus-a": "PIA15421",
};

// Per le altre: query + parole attese nel titolo.
const TARGETS = [
  { id: "carina", query: "Carina Nebula Hubble", must: ["carina"] },
  { id: "crab", query: "Crab Nebula Hubble", must: ["crab"] },
  { id: "whirlpool", query: "Whirlpool Galaxy M51 Hubble", must: ["whirlpool"] },
  { id: "helix", query: "Helix Nebula Hubble", must: ["helix", "dying star"] },
  { id: "tarantula", query: "Tarantula Nebula Hubble", must: ["tarantula", "storm"] },
  { id: "pleiades", query: "Pleiades star cluster infrared", must: ["pleiad"] },
  { id: "horsehead", query: "Horsehead Nebula Hubble infrared", must: ["horsehead"] },
  { id: "m83", query: "Southern Pinwheel Galaxy M83 Hubble", must: ["m83", "pinwheel"] },
  { id: "antennae", query: "Antennae Galaxies Hubble", must: ["antennae"] },
];

const BAD = /(artist|illustration|concept|render|drawing|diagram|infographic|poster|chart|animation|simulation|logo|patch)/i;

async function search(q) {
  const url = `${API}?q=${encodeURIComponent(q)}&media_type=image&page_size=25`;
  const res = await fetch(url, { headers: { "User-Agent": "starry-daily/1.0" } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = await res.json();
  return json?.collection?.items ?? [];
}

function score(item, must) {
  const d = item.data?.[0] ?? {};
  const text = `${d.title ?? ""} ${d.description ?? ""}`.toLowerCase();
  if (BAD.test(text)) return -1;
  let s = 0;
  for (const m of must) if (text.includes(m)) s += 6;
  if (/hubble|webb|chandra|spitzer/.test(text)) s += 3;
  if (/hubble heritage|esa\/hubble/.test(text)) s += 2;
  return s;
}

async function findImage(nasaId) {
  const res = await fetch(`${ASSETS}/${nasaId}/collection.json`);
  if (!res.ok) return null;
  const files = await res.json();
  for (const size of ["~medium.jpg", "~small.jpg", "~orig.jpg", "~large.jpg"]) {
    const hit = files.find((f) => f.endsWith(size));
    if (hit) return hit;
  }
  return null;
}

async function meta(nasaId) {
  const res = await fetch(`${API}?nasa_id=${encodeURIComponent(nasaId)}`);
  if (!res.ok) return null;
  const items = (await res.json())?.collection?.items ?? [];
  return items[0]?.data?.[0] ?? null;
}

async function save(id, d) {
  const file = await findImage(d.nasa_id);
  if (!file) throw new Error("file immagine non trovato");
  const dest = path.join(OUT_IMG, `${id}.jpg`);
  if (!existsSync(dest)) {
    const buf = Buffer.from(await (await fetch(file)).arrayBuffer());
    if (buf.byteLength < 8000) throw new Error("immagine troppo piccola");
    await writeFile(dest, buf);
  }
  const text = `${d.title} ${d.description} ${d.secondary_creator ?? ""}`;
  const telescope = /hubble/i.test(text)
    ? "Hubble"
    : /spitzer/i.test(text)
      ? "Spitzer"
      : /chandra/i.test(text)
        ? "Chandra"
        : /webb/i.test(text)
          ? "James Webb"
          : "Hubble";
  return {
    id,
    nasaId: d.nasa_id,
    nasaTitle: (d.title ?? "").replace(/\s+/g, " ").trim(),
    telescope,
    credit: (d.secondary_creator ?? d.center ?? "NASA").replace(/\s+/g, " ").trim(),
    date: (d.date_created ?? "").slice(0, 10),
    file: `/photos/${id}.jpg`,
    nasaUrl: `https://images.nasa.gov/details-${d.nasa_id}`,
  };
}

await mkdir(OUT_IMG, { recursive: true });
const out = [];

for (const [id, nasaId] of Object.entries(PICK)) {
  try {
    const d = await meta(nasaId);
    if (!d) throw new Error("metadati non trovati");
    out.push(await save(id, d));
    console.log(`ok  ${id.padEnd(16)} ${d.nasa_id}  ${d.title}`);
  } catch (err) {
    console.warn(`!!  ${id}: ${err.message}`);
  }
}

for (const t of TARGETS) {
  try {
    const items = await search(t.query);
    const ranked = items
      .map((it) => ({ it, s: score(it, t.must) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    let done = false;
    for (const { it } of ranked.slice(0, 5)) {
      const d = it.data[0];
      try {
        out.push(await save(t.id, d));
        console.log(`ok  ${t.id.padEnd(16)} ${d.nasa_id}  ${d.title}`);
        done = true;
        break;
      } catch {
        /* prova il candidato successivo */
      }
    }
    if (!done) console.warn(`!!  ${t.id}: nessuna immagine valida`);
  } catch (err) {
    console.warn(`!!  ${t.id}: ${err.message}`);
  }
}

out.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(OUT_DATA, JSON.stringify(out, null, 2));
let total = 0;
for (const o of out) total += (await stat(path.join("public", o.file))).size;
console.log(`\n${out.length} immagini, ${(total / 1e6).toFixed(1)} MB totali`);
for (const o of out) console.log(`   ${o.id.padEnd(16)} ${o.telescope.padEnd(9)} ${o.date}  ${o.nasaTitle}`);
