import { fetchRss } from "./rss";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  /** Data ISO di pubblicazione. */
  date: string;
  source: string;
  summary: string;
  image: string;
}

interface SnapiArticle {
  id: number;
  title: string;
  url: string;
  image_url: string;
  news_site: string;
  summary: string;
  published_at: string;
}

/** Spaceflight News API: notizie da NASA, ESA, SpaceNews, Spaceflight Now e altre testate. */
async function spaceflightNews(): Promise<NewsItem[]> {
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=24&ordering=-published_at");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { results?: SnapiArticle[] };
  return (payload.results ?? []).map((a) => ({
    id: `snapi-${a.id}`,
    title: a.title,
    url: a.url,
    date: a.published_at,
    source: a.news_site,
    summary: a.summary,
    image: a.image_url,
  }));
}

async function nasaScience(): Promise<NewsItem[]> {
  const items = await fetchRss("https://science.nasa.gov/feed/", 12);
  return items.map((item) => ({
    id: item.link,
    title: item.title,
    url: item.link,
    date: item.date,
    source: "NASA Science",
    summary: item.summary,
    image: item.image,
  }));
}

const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Notizie di oggi da tutte le fonti, senza doppioni e dalla più recente. */
export async function loadNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled([spaceflightNews(), nasaScience()]);
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const key = titleKey(item.title);
      if (seen.has(key) || seen.has(item.url)) continue;
      seen.add(key);
      seen.add(item.url);
      items.push(item);
    }
  }
  if (!items.length) throw new Error("Nessuna fonte di notizie raggiungibile");
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
