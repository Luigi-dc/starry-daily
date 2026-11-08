/**
 * Dati live presi dal browser, senza proxy e senza rebuild:
 * banca dati immagini NASA e feed delle notizie.
 * Se una chiamata fallisce, chi chiama usa i dati salvati nel sito.
 */

export interface LivePhoto {
  id: string;
  nasaId: string;
  title: string;
  description: string;
  telescope: string;
  date: string;
  thumb: string;
  full: string;
}

export interface LiveNewsItem {
  title: string;
  link: string;
  date: string;
  summary: string;
  categories: string[];
}

export interface PhotoSnapshot {
  at: number;
  photos: LivePhoto[];
}

const PHOTO_CACHE_KEY = "starry-daily/photos-v7";
const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

/** Missioni e telescopi: ogni voce è una ricerca nella banca dati NASA. */
/** Oggetti celebri: la ricerca per nome restituisce le foto astronomiche vere, non gli eventi. */
const PHOTO_QUERIES = [
  "Orion Nebula",
  "Crab Nebula",
  "Pillars of Creation",
  "Carina Nebula",
  "Eagle Nebula",
  "Horsehead Nebula",
  "Ring Nebula",
  "Lagoon Nebula",
  "Trifid Nebula",
  "Helix Nebula",
  "Dumbbell Nebula",
  "Rosette Nebula",
  "Andromeda Galaxy",
  "Whirlpool Galaxy",
  "Sombrero Galaxy",
  "Triangulum Galaxy",
  "Pinwheel Galaxy",
  "Centaurus A",
  "Hubble deep field",
  "Omega Centauri",
  "Pleiades",
  "Beehive Cluster",
  "Milky Way",
  "Supernova 1987A",
  "Jupiter",
  "Saturn",
  "Mars",
  "Moon",
];

const PHOTOS_PER_QUERY = 8;

/** Ricerche ampie su più pagine: da qui arriva il grosso della banca dati. */
const BROAD_QUERIES = ["nebula", "galaxy", "star cluster", "supernova"];
const BROAD_PAGES = 3;

/** Una foto entra in galleria solo se parla di astronomia. */
const ASTRO_TERMS =
  /nebula|galaxy|galaxies|cluster|supernova|pulsar|quasar|milky way|orion|pleiades|crab|andromeda|comet|eclipse|aurora|planet|asteroid|cosmic|deep field|spiral|star|solar|jupiter|saturn|mars|venus|mercury|neptune|uranus|moon|luna/i;

/** La banca dati contiene anche comunicati, lanci e conferenze: non sono foto del cielo. */
const NOT_ASTROPHOTO = /briefing|press conference|administrator|ceremony|award|signing|meeting|panel|interview|media day|crew|remarks|hearing|budget|town hall|announcement|portrait|employees|launch|landing|encapsulation|rocket|cleanroom|assembly|mission control|keynote|address|operations|infrastructure|administration|headquarters|directorate|antenna|engineer|technician|mockup|replica|facility|building|visitor|center tour|moon to mars|program|habitation|transportation|multidisciplinary|science directorate/i;

export function cachedPhotos(): PhotoSnapshot | null {
  try {
    const raw = localStorage.getItem(PHOTO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhotoSnapshot;
    if (!Array.isArray(parsed.photos) || !parsed.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function photosAreFresh(snapshot: PhotoSnapshot): boolean {
  return Date.now() - snapshot.at < PHOTO_TTL_MS;
}

function savePhotos(snapshot: PhotoSnapshot): void {
  try {
    localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // spazio esaurito o storage bloccato: si continua senza cache
  }
}

interface NasaItem {
  data?: Array<Record<string, string>>;
  links?: Array<{ href?: string }>;
}

async function searchPhotos(query: string, page = 1, pageSize = PHOTOS_PER_QUERY): Promise<LivePhoto[]> {
  const url =
    `https://images-api.nasa.gov/search?media_type=image&page_size=${pageSize}&page=${page}` +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { collection?: { items?: NasaItem[] } };
  const items = payload.collection?.items ?? [];

  const photos: LivePhoto[] = [];
  for (const item of items) {
    const data = item.data?.[0];
    const link = item.links?.[0]?.href;
    if (!data || !link) continue;
    const haystack = `${data.title ?? ""} ${data.description ?? ""}`;
    if (NOT_ASTROPHOTO.test(haystack)) continue;
    if (!ASTRO_TERMS.test(haystack)) continue;
    photos.push({
      id: data.nasa_id ?? link,
      nasaId: data.nasa_id ?? "",
      title: data.title ?? "Immagine NASA",
      description: data.description ?? "",
      telescope: data.secondary_creator || data.center || "NASA",
      date: (data.date_created ?? "").slice(0, 10),
      thumb: link,
      full: link.replace("~thumb", "~medium").replace("~small", "~medium"),
    });
  }
  return photos;
}

/** Scarica (o rilegge dalla cache di 24 ore) la banca dati immagini. */
export async function loadLivePhotos(force = false): Promise<PhotoSnapshot | null> {
  if (!force) {
    const cached = cachedPhotos();
    if (cached && photosAreFresh(cached)) return cached;
  }

  const broad: Array<Promise<LivePhoto[]>> = [];
  for (const query of BROAD_QUERIES) {
    for (let page = 1; page <= BROAD_PAGES; page += 1) {
      broad.push(searchPhotos(query, page, 20).catch(() => [] as LivePhoto[]));
    }
  }

  const collections = await Promise.all([
    ...PHOTO_QUERIES.map((query) => searchPhotos(query).catch(() => [] as LivePhoto[])),
    ...broad,
  ]);

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const photos: LivePhoto[] = [];

  const add = (list: LivePhoto[]) => {
    for (const photo of list) {
      const titleKey = photo.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (seenIds.has(photo.id) || seenTitles.has(titleKey)) continue;
      seenIds.add(photo.id);
      seenTitles.add(titleKey);
      photos.push(photo);
    }
  };

  for (const list of collections) add(list);

  if (!photos.length) return cachedPhotos();

  photos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const snapshot: PhotoSnapshot = { at: Date.now(), photos };
  savePhotos(snapshot);
  return snapshot;
}

const decodeEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

const cleanSummary = (text: string): string =>
  text.replace(/The post\s.*?appeared first on\s[^.]*\.?/i, "").replace(/\s+/g, " ").trim();

const field = (block: string, name: string): string => {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
};

/** Legge il feed NASA direttamente dal browser: le notizie sono sempre quelle di oggi. */
export async function loadLiveNews(): Promise<LiveNewsItem[] | null> {
  try {
    const res = await fetch("https://science.nasa.gov/feed/");
    if (!res.ok) return null;
    const xml = await res.text();

    const blocks = xml.split("<item>").slice(1, 13);
    const items: LiveNewsItem[] = [];

    for (const block of blocks) {
      const title = field(block, "title");
      const link = field(block, "link");
      if (!title || !link) continue;
      const published = field(block, "pubDate");
      const parsed = new Date(published);
      const categories = [...block.matchAll(/<category>([\s\S]*?)<\/category>/gi)]
        .map((match) => decodeEntities(match[1]))
        .slice(0, 3);

      items.push({
        title,
        link,
        date: Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10),
        summary: cleanSummary(field(block, "description")).slice(0, 300),
        categories,
      });
    }

    return items.length ? items : null;
  } catch {
    return null;
  }
}
