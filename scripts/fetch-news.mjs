// Scarica le notizie spaziali dal feed RSS di NASA Science, ne salva anche il testo
// degli articoli (per la lettura dentro il sito) e scrive src/data/news.json.
// Uso: node scripts/fetch-news.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";

const FEED = "https://science.nasa.gov/feed/";
const OUT = path.resolve("src/data/news.json");
const MAX_ITEMS = 12;
const MAX_PARAGRAPHS = 14;

const decode = (s = "") =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

/** Le descrizioni del feed sono frasi di servizio: le togliamo. */
const cleanSummary = (text) =>
  text
    .replace(/The post\s.*?appeared first on\s[^.]*\.?/i, "")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : "";
};

/** Estrae i paragrafi dell'articolo dall'HTML della pagina. */
function extractParagraphs(html) {
  const scope =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? "";
  if (!scope) return [];

  const cleaned = scope
    .replace(/<(script|style|noscript|svg|form|nav|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<figure[\s\S]*?<\/figure>/gi, " ");

  const paragraphs = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decode(match[1].replace(/<[^>]+>/g, " ")))
    .filter(
      (text) =>
        text.length > 60 &&
        !/^The post .* appeared first/i.test(text) &&
        !/^(Share|Read more|Image credit|Credits?:|Tags?:)/i.test(text),
    );

  return [...new Set(paragraphs)].slice(0, MAX_PARAGRAPHS);
}

async function articleContent(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "starry-daily/1.0" } });
    if (!res.ok) return { content: [], image: "" };
    const html = await res.text();
    const image =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      "";
    return { content: extractParagraphs(html), image };
  } catch {
    return { content: [], image: "" };
  }
}

const res = await fetch(FEED, { headers: { "User-Agent": "starry-daily/1.0" } });
if (!res.ok) throw new Error(`feed ${res.status}`);
const xml = await res.text();

const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
console.log(`${blocks.length} voci nel feed`);

const news = [];
for (const block of blocks.slice(0, MAX_ITEMS)) {
  const categories = [...block.matchAll(/<category>([\s\S]*?)<\/category>/gi)].map((c) =>
    decode(c[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")),
  );
  const feedImage = block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ?? "";
  const link = tag(block, "link");
  const article = link ? await articleContent(link) : { content: [], image: "" };

  news.push({
    title: tag(block, "title"),
    link,
    date: new Date(tag(block, "pubDate") || Date.now()).toISOString().slice(0, 10),
    summary: cleanSummary(tag(block, "description")).slice(0, 300),
    categories: categories.slice(0, 3),
    image: article.image || feedImage,
    content: article.content,
  });
  console.log(
    `- ${news.at(-1).title.slice(0, 58)} · ${article.content.length} par. · immagine ${article.image ? "sì" : "no"}`,
  );
}

const payload = {
  source: "NASA Science",
  sourceUrl: "https://science.nasa.gov/",
  fetchedAt: new Date().toISOString(),
  items: news.filter((item) => item.title && item.link),
};

await writeFile(OUT, JSON.stringify(payload, null, 2));
console.log(`scritte ${payload.items.length} notizie in src/data/news.json`);
