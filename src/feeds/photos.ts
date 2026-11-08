import { decodeEntities, fetchRss } from "./rss";

export interface SpacePhoto {
  id: string;
  title: string;
  /** Data ISO (o AAAA-MM-GG). */
  date: string;
  thumb: string;
  full: string;
  credit: string;
  description: string;
  /** Pagina originale della foto. */
  link: string;
  /** Per i video: indirizzo da incorporare al posto dell'immagine. */
  video?: string;
}

/* ---------- APOD: la foto astronomica del giorno ---------- */

/**
 * APOD ora vive su science.nasa.gov (l'API api.nasa.gov/planetary/apod restituisce dati segnaposto):
 * si leggono gli articoli APOD dalla REST API di WordPress del sito, che consente CORS.
 */
interface WpImageArticle {
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  _embedded?: { "wp:featuredmedia"?: Array<{ source_url?: string; mime_type?: string }> };
}

const htmlText = (value: string) => decodeEntities(value.replace(/<[^>]+>/g, " "));

export async function loadApod(count = 8): Promise<SpacePhoto[]> {
  const url =
    `https://science.nasa.gov/wp-json/wp/v2/image-article?per_page=${count}&search=APOD&_embed=wp:featuredmedia` +
    "&_fields=date,link,title,content,_links,_embedded";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = (await res.json()) as WpImageArticle[];
  const photos: SpacePhoto[] = [];
  for (const post of posts) {
    const title = decodeEntities(post.title.rendered);
    if (!/^APOD:/i.test(title)) continue;
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    if (!media?.source_url || (media.mime_type && !media.mime_type.startsWith("image/"))) continue;
    const text = htmlText(post.content.rendered);
    const explanation = text.match(/Explanation:\s*([\s\S]*?)(?:Tomorrow.s picture|Date:?\s|$)/i)?.[1]?.trim() ?? "";
    const credit = text.match(/Credit(?:\s*&\s*Copyright)?:?\s*([\s\S]*?)\s*Authors/i)?.[1]?.trim();
    const src = media.source_url.split("?")[0];
    photos.push({
      id: post.link,
      title: title.replace(/^APOD:\s*\d{4}\s+\S+\s+\d{1,2}\s*[–-]\s*/i, ""),
      date: post.date.slice(0, 10),
      thumb: `${src}?w=900&fit=clip`,
      full: `${src}?w=2400&fit=clip`,
      credit: credit ? `NASA APOD · ${credit}` : "NASA APOD",
      description: explanation,
      link: post.link,
    });
  }
  return photos;
}

/* ---------- EPIC: la Terra intera dal satellite DSCOVR ---------- */

interface EpicEntry {
  identifier: string;
  image: string;
  date: string;
  centroid_coordinates?: { lat: number; lon: number };
}

export async function loadEpic(): Promise<SpacePhoto[]> {
  const res = await fetch("https://epic.gsfc.nasa.gov/api/natural");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entries = (await res.json()) as EpicEntry[];
  return entries
    .map((e) => {
      const [day, time] = e.date.split(" ");
      const path = `https://epic.gsfc.nasa.gov/archive/natural/${day.replace(/-/g, "/")}`;
      const c = e.centroid_coordinates;
      const centre = c
        ? `Al centro dell'immagine: latitudine ${c.lat.toFixed(1)}°, longitudine ${c.lon.toFixed(1)}°.`
        : "";
      return {
        id: `epic-${e.identifier}`,
        title: `La Terra alle ${time.slice(0, 5)} UTC`,
        date: `${day}T${time}Z`,
        thumb: `${path}/thumbs/${e.image}.jpg`,
        full: `${path}/jpg/${e.image}.jpg`,
        credit: "NASA EPIC · satellite NOAA DSCOVR",
        description:
          "Foto dell'intero disco terrestre scattata dalla camera EPIC a bordo del satellite DSCOVR, " +
          `in orbita attorno al punto lagrangiano L1 a 1,5 milioni di km dalla Terra. ${centre}`,
        link: `https://epic.gsfc.nasa.gov/?date=${day}`,
      };
    })
    .reverse();
}

/* ---------- Webb e Hubble: i comunicati ESA con immagine ---------- */

const RELEASE_PREFIX = /^(Photo|Science|Organisation|Picture of the Month|Webb Picture of the Month|Hubble Picture of the Week)[^:]*:\s*/i;

export async function loadEsa(): Promise<SpacePhoto[]> {
  const feeds: Array<{ url: string; credit: string }> = [
    { url: "https://esawebb.org/news/feed/", credit: "ESA/Webb · NASA, ESA, CSA" },
    { url: "https://esahubble.org/news/feed/", credit: "ESA/Hubble · NASA, ESA" },
  ];
  const results = await Promise.allSettled(feeds.map((f) => fetchRss(f.url, 12)));
  const seen = new Set<string>();
  const photos: SpacePhoto[] = [];

  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    for (const item of result.value) {
      if (!item.image) continue;
      const title = item.title.replace(RELEASE_PREFIX, "");
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      photos.push({
        id: item.link,
        title,
        date: item.date,
        thumb: item.image,
        full: item.image.replace("/screen/", "/large/"),
        credit: feeds[i].credit,
        description: item.summary,
        link: item.link,
      });
    }
  });

  if (!photos.length) throw new Error("Feed ESA non raggiungibili");
  return photos.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Libreria immagini NASA: le più recenti ---------- */

const NASA_QUERIES = ["james webb", "hubble", "chandra", "juno", "earth from space", "international space station earth"];

/** La libreria contiene anche conferenze, cerimonie e lanci: non sono foto dallo spazio. */
const NOT_SPACE_PHOTO =
  /briefing|press conference|administrator|ceremony|award|signing|meeting|panel|interview|media day|remarks|hearing|budget|town hall|portrait|employees|launch|landing|rocket|cleanroom|assembly|mission control|keynote|facility|building|visitor|technician|engineer|mockup|replica|test stand|training|suit|announcement|viewing|headquarters|\bhq\b|event|celebration|tour|students/i;

interface NasaItem {
  data?: Array<Record<string, string>>;
  links?: Array<{ href?: string; rel?: string }>;
}

async function searchNasa(query: string, yearStart: number): Promise<SpacePhoto[]> {
  const url =
    `https://images-api.nasa.gov/search?media_type=image&page_size=30&year_start=${yearStart}` +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { collection?: { items?: NasaItem[] } };
  const photos: SpacePhoto[] = [];
  for (const item of payload.collection?.items ?? []) {
    const data = item.data?.[0];
    const thumb = item.links?.find((l) => l.rel === "preview")?.href ?? item.links?.[0]?.href;
    if (!data || !thumb) continue;
    if (NOT_SPACE_PHOTO.test(`${data.title ?? ""} ${data.keywords ?? ""}`)) continue;
    photos.push({
      id: data.nasa_id ?? thumb,
      title: data.title ?? "Immagine NASA",
      date: data.date_created ?? "",
      thumb,
      full:
        item.links?.find((l) => l.href?.includes("~large."))?.href ??
        item.links?.find((l) => l.href?.includes("~medium."))?.href ??
        thumb,
      credit: data.secondary_creator || data.photographer || data.center || "NASA",
      description: decodeHtml(data.description ?? ""),
      link: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id ?? "")}`,
    });
  }
  return photos;
}

const decodeHtml = (text: string) => text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function loadNasaImages(limit = 24): Promise<SpacePhoto[]> {
  const now = new Date();
  // a gennaio l'anno è appena iniziato: si guarda anche al precedente
  const yearStart = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const results = await Promise.allSettled(NASA_QUERIES.map((q) => searchNasa(q, yearStart)));
  const seen = new Set<string>();
  const photos: SpacePhoto[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const photo of result.value) {
      const key = photo.title.toLowerCase();
      if (seen.has(photo.id) || seen.has(key)) continue;
      seen.add(photo.id);
      seen.add(key);
      photos.push(photo);
    }
  }
  if (!photos.length) throw new Error("Libreria immagini NASA non raggiungibile");
  return photos.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
