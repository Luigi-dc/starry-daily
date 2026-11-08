// Scarica un catalogo stellare reale (magnitudine <= 6) e le figure delle costellazioni
// da d3-celestial (licenza MIT) e produce src/data/sky.json in forma compatta.
// Uso: node scripts/fetch-sky.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data";
const OUT = path.resolve("src/data/sky.json");

const get = async (name) => {
  const res = await fetch(`${BASE}/${name}`, { headers: { "User-Agent": "starry-daily/1.0" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
};

const round = (value, digits) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const [starsRaw, linesRaw, metaRaw] = await Promise.all([
  get("stars.6.json"),
  get("constellations.lines.json"),
  get("constellations.json"),
]);

// verifica dell'orientamento: Sirio (HIP 32349) deve stare a RA 6h45m, Dec -16.7
const sirius = starsRaw.features.find((f) => f.id === 32349);
console.log("Sirio nel catalogo:", sirius ? sirius.geometry.coordinates : "assente");

/** [lon, lat] del catalogo -> [ore di ascensione retta, declinazione in gradi] */
const toRaDec = ([lon, lat]) => {
  const ra = (((lon / 15) % 24) + 24) % 24;
  return [round(ra, 3), round(lat, 2)];
};

const stars = starsRaw.features
  .map((f) => {
    const [ra, dec] = toRaDec(f.geometry.coordinates);
    return [ra, dec, round(f.properties.mag ?? 6, 2), round(Number(f.properties.bv ?? 0.6), 2)];
  })
  .filter((s) => Number.isFinite(s[0]) && Number.isFinite(s[1]));

const names = new Map(metaRaw.features.map((f) => [f.id, f.properties.it || f.properties.en || f.properties.la || f.id]));

const constellations = linesRaw.features.map((feature) => {
  const paths = (feature.geometry.type === "MultiLineString" ? feature.geometry.coordinates : [feature.geometry.coordinates])
    .map((line) => line.map(toRaDec));

  // centroide in vettori unitari, per non sbagliare sull'attraversamento di RA 0h
  let x = 0, y = 0, z = 0, n = 0;
  for (const line of paths) {
    for (const [ra, dec] of line) {
      const a = (ra * 15 * Math.PI) / 180;
      const d = (dec * Math.PI) / 180;
      x += Math.cos(d) * Math.cos(a);
      y += Math.cos(d) * Math.sin(a);
      z += Math.sin(d);
      n += 1;
    }
  }
  const centreRa = n ? ((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) / 15) : 0;
  const centreDec = n ? (Math.asin(z / Math.hypot(x, y, z)) * 180) / Math.PI : 0;

  return {
    id: feature.id,
    name: names.get(feature.id) ?? feature.id,
    ra: round(centreRa, 2),
    dec: round(centreDec, 1),
    lines: paths,
  };
});

const payload = {
  source: "d3-celestial · catalogo stellare (mag ≤ 6) e costellazioni, MIT",
  fetchedAt: new Date().toISOString(),
  stars,
  constellations,
};

await writeFile(OUT, JSON.stringify(payload));
console.log(`stelle: ${stars.length} · costellazioni: ${constellations.length} · file: ${OUT}`);
