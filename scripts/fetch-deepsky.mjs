// Converte il catalogo Messier (d3-celestial, MIT) in src/data/deepsky.json.
// Uso: node scripts/fetch-deepsky.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/messier.json";
const OUT = path.resolve("src/data/deepsky.json");

const KIND = {
  snr: "remnant",
  gc: "cluster",
  oc: "cluster",
  sfr: "nebula",
  pn: "nebula",
  rn: "nebula",
  pos: "galaxy",
  s: "galaxy",
  e: "galaxy",
  i: "galaxy",
};

const LABEL = {
  remnant: "Resto di supernova",
  cluster: "Ammasso",
  nebula: "Nebulosa",
  galaxy: "Galassia",
};

const ITALIAN = {
  M1: "Nebulosa del Granchio",
  M3: "Ammasso di Cani da Caccia",
  M6: "Ammasso Farfalla",
  M7: "Ammasso di Tolomeo",
  M8: "Nebulosa Laguna",
  M11: "Ammasso Anitra Selvatica",
  M13: "Grande Ammasso di Ercole",
  M16: "Nebulosa Aquila",
  M17: "Nebulosa Omega",
  M20: "Nebulosa Trifida",
  M22: "Ammasso di Sagittario",
  M27: "Nebulosa Manubrio",
  M31: "Galassia di Andromeda",
  M33: "Galassia del Triangolo",
  M35: "Ammasso dei Gemelli",
  M42: "Nebulosa di Orione",
  M43: "Nebulosa De Mairan",
  M44: "Presepe",
  M45: "Pleiadi",
  M51: "Galassia Vortice",
  M57: "Nebulosa Anello",
  M63: "Galassia Girasole",
  M64: "Galassia Occhio Nero",
  M76: "Nebulosa Piccolo Manubrio",
  M77: "Galassia Cetus A",
  M78: "Nebulosa di Orione B",
  M81: "Galassia di Bode",
  M82: "Galassia Sigaro",
  M83: "Galassia Girandola del Sud",
  M87: "Galassia Virgo A",
  M97: "Nebulosa Civetta",
  M101: "Galassia Girandola",
  M104: "Galassia Sombrero",
};

const res = await fetch(SRC, { headers: { "User-Agent": "starry-daily/1.0" } });
if (!res.ok) throw new Error(`messier.json: HTTP ${res.status}`);
const raw = await res.json();

const objects = raw.features.map((feature) => {
  const props = feature.properties ?? {};
  const [lon, lat] = feature.geometry.coordinates;
  const id = String(feature.id).toLowerCase();
  const alt = props.alt || "";
  const desig = props.desig || "";
  const kind = KIND[props.type] ?? "galaxy";
  const common = ITALIAN[feature.id] || alt;

  return {
    id,
    name: common ? `${feature.id} · ${common}` : feature.id,
    kind,
    ra: Math.round((((lon / 15) % 24) + 24) % 24 * 1000) / 1000,
    dec: Math.round(lat * 100) / 100,
    distance: props.mag ? `magnitudine ${props.mag}` : "catalogo Messier",
    description:
      `${LABEL[kind]} del catalogo Messier` +
      (alt ? `, conosciuta come ${alt}` : "") +
      (desig ? ` e catalogata ${desig}` : "") +
      (props.dim ? `. Dimensione apparente ${String(props.dim).replace("x", "×")} minuti d'arco.` : "."),
    aliases: [feature.id, feature.id.toUpperCase(), desig, alt].filter(Boolean),
  };
});

await writeFile(OUT, JSON.stringify({ source: "d3-celestial · catalogo Messier (MIT)", fetchedAt: new Date().toISOString(), objects }, null, 0));
console.log(`oggetti Messier: ${objects.length} · file: ${OUT}`);
