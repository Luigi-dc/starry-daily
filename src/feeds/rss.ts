/** Lettura minimale dei feed RSS, condivisa da notizie e comunicati ESA. */

export interface RssItem {
  title: string;
  link: string;
  date: string;
  /** Testo della descrizione, senza HTML. */
  summary: string;
  /** Prima immagine trovata: enclosure, media:content o <img> nella descrizione. */
  image: string;
  categories: string[];
}

export function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

const raw = (block: string, name: string): string => {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : "";
};

function findImage(block: string): string {
  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image|<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i);
  if (enclosure) return enclosure[1] || enclosure[2];
  const media = block.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i);
  if (media) return media[1];
  const description = raw(block, "description").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const img = description.match(/<img[^>]*src="([^"]+)"/i);
  return img ? img[1] : "";
}

function isoDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export async function fetchRss(url: string, limit = 20): Promise<RssItem[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  return xml
    .split(/<item[\s>]/)
    .slice(1, limit + 1)
    .map((block) => ({
      title: decodeEntities(raw(block, "title")),
      link: decodeEntities(raw(block, "link")) || decodeEntities(raw(block, "guid")),
      date: isoDate(decodeEntities(raw(block, "pubDate"))),
      summary: decodeEntities(raw(block, "description"))
        .replace(/The post\s.*?appeared first on\s[^.]*\.?/i, "")
        .trim(),
      image: findImage(block).replace(/^http:/, "https:"),
      categories: [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => decodeEntities(m[1])),
    }))
    .filter((item) => item.title && item.link);
}
