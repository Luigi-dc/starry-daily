import "./style.css";
import { SkyView, type SkyTarget } from "./three/sky";
import { PlanetView } from "./three/planet";
import { KIND_LABEL, OBJECTS, type Kind, type SkyObject } from "./data/objects";
import { SOLAR_BODIES, SOLAR_COMPUTED_AT, type SolarBody } from "./data/solar";
import { buildIndex, searchSky } from "./search";
import photosJson from "./data/photos.json";
import newsJson from "./data/news.json";
import deepskyJson from "./data/deepsky.json";
import { cachedPhotos, loadLiveNews, loadLivePhotos, type LivePhoto } from "./live";

interface Photo {
  id: string;
  nasaId: string;
  nasaTitle: string;
  telescope: string;
  credit: string;
  date: string;
  file: string;
  nasaUrl: string;
}

interface NewsItem {
  title: string;
  link: string;
  date: string;
  summary: string;
  categories: string[];
  image?: string;
  /** Paragrafi dell'articolo salvati in locale per la lettura dentro il sito. */
  content?: string[];
}

interface NewsFeed {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  items: NewsItem[];
}

const photos = photosJson as Photo[];
const feed = newsJson as NewsFeed;
const photoById = new Map(photos.map((p) => [p.id, p]));
const deepskyObjects = (deepskyJson as { objects: SkyObject[] }).objects;
const ALL_OBJECTS: SkyObject[] = [...OBJECTS, ...SOLAR_BODIES, ...deepskyObjects];
const objectById = new Map(ALL_OBJECTS.map((o) => [o.id, o]));
const searchIndex = buildIndex(ALL_OBJECTS);

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;

const canvas = $<HTMLCanvasElement>("#sky");
const labelLayer = $<HTMLDivElement>("#labels");
const grid = $<HTMLDivElement>("#photo-grid");
const chips = $<HTMLDivElement>("#kind-chips");
const newsList = $<HTMLDivElement>("#news-list");
const hudCoords = $<HTMLParagraphElement>("#hud-coords");
const detail = $<HTMLElement>("#detail");
const searchInput = $<HTMLInputElement>("#search-input");
const searchResults = $<HTMLDivElement>("#search-results");
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const views: Record<string, HTMLElement> = {
  news: $<HTMLDivElement>("#view-news"),
  photos: $<HTMLDivElement>("#view-photos"),
};

const planetView = new PlanetView($<HTMLCanvasElement>("#detail-planet"));

/* ---------- etichette di intervallo e formattazione ---------- */

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });
const fmtDate = (iso: string) => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : dateFmt.format(parsed);
};

const raLabel = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

const decLabel = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(1)}°`;

/** Il feed descrive le notizie con una frase di servizio: non va mostrata. */
const cleanTeaser = (text: string) =>
  text
    .replace(/The post\s.*?appeared first on\s[^.]*\.?/i, "")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- notizie ---------- */

function renderNews(): void {
  newsList.textContent = "";
  for (const item of feed.items.slice(0, 10)) {
    const article = document.createElement("button");
    article.type = "button";
    article.className = "news-item";
    article.addEventListener("click", () => openNews(item));

    const meta = document.createElement("div");
    meta.className = "news-meta";
    const dot = document.createElement("span");
    dot.className = "news-dot";
    const date = document.createElement("span");
    date.textContent = fmtDate(item.date);
    const source = document.createElement("span");
    source.textContent = "NASA";
    meta.append(dot, date, source);

    const title = document.createElement("h2");
    title.className = "news-title";
    title.textContent = item.title;

    article.append(meta, title);

    const teaser = cleanTeaser(item.summary);
    if (teaser) {
      const summary = document.createElement("p");
      summary.className = "news-summary";
      summary.textContent = teaser;
      article.append(summary);
    }

    if (item.categories.length) {
      const tags = document.createElement("div");
      tags.className = "news-tags";
      for (const category of item.categories) {
        const tag = document.createElement("span");
        tag.className = "news-tag";
        tag.textContent = category;
        tags.append(tag);
      }
      article.append(tags);
    }

    newsList.append(article);
  }

  const fetched = new Date(feed.fetchedAt);
  $<HTMLSpanElement>("#source-note").textContent =
    `Notizie: ${feed.source} · aggiornate ${Number.isNaN(fetched.getTime()) ? "—" : dateFmt.format(fetched)}. ` +
    `Foto: archivio NASA (Hubble, Spitzer). Pianeti: posizioni calcolate per oggi. ` +
    `Mappa: stelle del catalogo reale (magnitudine ≤ 6) e costellazioni.`;
}

/* ---------- galleria ---------- */

const KIND_ORDER: Kind[] = ["nebula", "galaxy", "cluster", "remnant", "blackhole"];

function renderGallery(): void {
  grid.textContent = "";

  for (const object of OBJECTS) {
    const photo = photoById.get(object.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";
    card.dataset.id = object.id;
    card.dataset.kind = object.kind;

    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";

    if (photo) {
      const img = document.createElement("img");
      img.src = photo.file;
      img.alt = `${object.name} — immagine ${photo.telescope}`;
      img.loading = "lazy";
      img.decoding = "async";
      thumb.append(img);
    }

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = photo ? `Foto · ${photo.telescope}` : "Scheda";
    thumb.append(badge);

    const meta = document.createElement("div");
    meta.className = "photo-meta";
    const title = document.createElement("h3");
    title.textContent = object.name;
    const sub = document.createElement("p");
    sub.textContent = `${KIND_LABEL[object.kind]} · ${object.distance}`;
    meta.append(title, sub);

    card.append(thumb, meta);
    card.addEventListener("click", () => selectObject(object.id, { scroll: false }));
    card.addEventListener("pointerenter", () => hoverObject(object.id));
    card.addEventListener("pointerleave", () => hoverObject(null));

    grid.append(card);
  }
}

function renderChips(): void {
  chips.textContent = "";
  const options: Array<{ kind: Kind | null; label: string }> = [
    { kind: null, label: "Tutte" },
    ...KIND_ORDER.map((kind) => ({ kind, label: KIND_LABEL[kind] })),
  ];

  for (const option of options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${option.kind === null ? " is-active" : ""}`;
    chip.textContent = option.label;
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      const kind = option.kind;
      sky.setFilter(kind);
      grid.querySelectorAll<HTMLElement>(".photo-card").forEach((card) => {
        card.hidden = kind !== null && card.dataset.kind !== kind;
      });
    });
    chips.append(chip);
  }
}

/* ---------- banca dati NASA live ---------- */

const liveGrid = $<HTMLDivElement>("#live-grid");
const liveStatus = $<HTMLParagraphElement>("#live-status");

function renderLivePhotos(photos: LivePhoto[], at: number): void {
  liveGrid.textContent = "";
  for (const photo of photos) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";

    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = photo.thumb;
    img.alt = photo.title;
    img.loading = "lazy";
    img.decoding = "async";
    thumb.append(img);

    const meta = document.createElement("div");
    meta.className = "photo-meta";
    const title = document.createElement("h3");
    title.textContent = photo.title;
    const sub = document.createElement("p");
    sub.textContent = [photo.telescope, fmtDate(photo.date)].filter(Boolean).join(" · ");
    meta.append(title, sub);

    card.append(thumb, meta);
    card.addEventListener("click", () => openPhotoReader(photo));
    liveGrid.append(card);
  }

  const updated = new Date(at);
  liveStatus.textContent =
    `${photos.length} immagini dall'archivio NASA · aggiornate ` +
    `${Number.isNaN(updated.getTime()) ? "oggi" : dateFmt.format(updated)}`;
}

async function refreshLivePhotos(force: boolean): Promise<void> {
  const cached = cachedPhotos();
  if (cached && !force) renderLivePhotos(cached.photos, cached.at);

  const snapshot = await loadLivePhotos(force);
  if (!snapshot) {
    liveStatus.textContent = "Archivio NASA non raggiungibile: restano le immagini salvate nel sito.";
    return;
  }
  renderLivePhotos(snapshot.photos, snapshot.at);
}

function openPhotoReader(photo: LivePhoto): void {
  const body = document.createElement("div");
  body.className = "reader-text";

  const figure = document.createElement("figure");
  figure.className = "reader-figure";
  const image = document.createElement("img");
  image.src = photo.full;
  image.alt = photo.title;
  figure.append(image);
  body.append(figure);

  if (photo.description) {
    const text = document.createElement("p");
    text.textContent = photo.description;
    body.append(text);
  }

  body.append(
    factsList([
      { label: "Missione", value: photo.telescope },
      { label: "Data", value: photo.date || "—" },
      { label: "Archivio", value: `NASA images · ${photo.nasaId}` },
    ]),
  );

  openReader(
    "Banca dati NASA",
    photo.title,
    [photo.telescope, fmtDate(photo.date)].filter(Boolean).join(" · "),
    body,
    "Immagine prelevata dall'archivio NASA e mostrata qui: la lettura non lascia la pagina.",
  );
}

/* ---------- scheda dettaglio ---------- */

function showDetail(object: SkyObject): void {
  const photo = photoById.get(object.id);
  const solar =
    object.kind === "planet" || object.kind === "moon" || object.kind === "sun" ? (object as SolarBody) : null;
  const img = $<HTMLImageElement>("#detail-img");
  const orb = $<HTMLDivElement>("#detail-orb");
  const source = $<HTMLButtonElement>("#detail-source");
  const badge = $<HTMLSpanElement>("#detail-badge");
  const facts = $<HTMLDListElement>("#detail-facts");

  currentObject = object;

  if (photo) {
    img.src = photo.file;
    img.alt = `${object.name} — immagine ${photo.telescope}`;
    img.hidden = false;
    orb.hidden = true;
    orb.classList.remove("is-3d");
    planetView.hide();
    badge.textContent = `${photo.telescope} · ${photo.date.slice(0, 4)}`;
  } else if (solar) {
    img.removeAttribute("src");
    img.hidden = true;
    orb.hidden = false;
    orb.style.setProperty("--orb-a", solar.tint[0]);
    orb.style.setProperty("--orb-b", solar.tint[1]);
    orb.classList.toggle("is-3d", planetView.show(solar.id));
    badge.textContent = solar.observer
      ? "Punto di osservazione"
      : `Posizione di oggi · ${dateFmt.format(SOLAR_COMPUTED_AT)}`;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
    orb.hidden = true;
    orb.classList.remove("is-3d");
    planetView.hide();
    badge.textContent = "";
  }

  facts.textContent = "";
  facts.hidden = !solar;
  if (solar) {
    for (const entry of solar.facts) {
      const term = document.createElement("dt");
      term.textContent = entry.label;
      const value = document.createElement("dd");
      value.textContent = entry.value;
      facts.append(term, value);
    }
  }

  source.textContent = "Scheda completa";
  source.hidden = false;

  const observer = (object as SolarBody).observer === true;
  $<HTMLParagraphElement>("#detail-kind").textContent = observer
    ? `${KIND_LABEL[object.kind]} · punto di osservazione`
    : `${KIND_LABEL[object.kind]} · RA ${raLabel(object.ra)} · Dec ${decLabel(object.dec)}`;
  $<HTMLHeadingElement>("#detail-name").textContent = object.name;
  $<HTMLParagraphElement>("#detail-meta").textContent = observer
    ? "sei qui · il cielo si guarda da questo pianeta"
    : `${object.distance}${photo ? ` · immagine: ${photo.credit}` : ""}`;
  $<HTMLParagraphElement>("#detail-desc").textContent = object.description;
  detail.hidden = false;
}

function hideDetail(): void {
  detail.hidden = true;
  planetView.hide();
}

/* ---------- stato e interazioni ---------- */

function setTab(name: string): void {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  Object.entries(views).forEach(([key, view]) => view.classList.toggle("is-active", key === name));
}

function setActiveCard(id: string | null): void {
  grid.querySelectorAll<HTMLElement>(".photo-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.id === id);
  });
}

function selectObject(id: string, options: { scroll?: boolean } = {}): void {
  const object = objectById.get(id);
  if (!object) return;
  sky.focus(id);
  showDetail(object);
  closeSearch();

  if (photoById.has(id)) {
    setActiveCard(id);
    setTab("photos");
    if (options.scroll !== false) {
      const card = grid.querySelector<HTMLElement>(`.photo-card[data-id="${id}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } else {
    setActiveCard(null);
  }
}

function hoverObject(id: string | null): void {
  if (!id) return;
  const object = objectById.get(id);
  if (object) canvas.title = object.name;
}

/* ---------- lettore interno (notizie e schede) ---------- */

const reader = $<HTMLElement>("#reader");
const readerBody = $<HTMLDivElement>("#reader-body");
let currentObject: SkyObject | null = null;
let restoreFocus: HTMLElement | null = null;

function factsList(entries: Array<{ label: string; value: string }>): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "facts";
  for (const entry of entries) {
    const term = document.createElement("dt");
    term.textContent = entry.label;
    const value = document.createElement("dd");
    value.textContent = entry.value;
    list.append(term, value);
  }
  return list;
}

function openReader(kicker: string, title: string, meta: string, body: HTMLElement, note: string): void {
  $<HTMLParagraphElement>("#reader-kicker").textContent = kicker;
  $<HTMLHeadingElement>("#reader-title").textContent = title;
  $<HTMLParagraphElement>("#reader-meta").textContent = meta;
  readerBody.textContent = "";
  readerBody.append(body);
  $<HTMLParagraphElement>("#reader-note").textContent = note;
  restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  reader.hidden = false;
  $<HTMLButtonElement>("#reader-close").focus();
}

function closeReader(): void {
  if (reader.hidden) return;
  reader.hidden = true;
  restoreFocus?.focus();
  restoreFocus = null;
}

function openNews(item: NewsItem): void {
  const body = document.createElement("div");
  body.className = "reader-text";

  if (item.image) {
    const figure = document.createElement("figure");
    figure.className = "reader-figure";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.title;
    image.loading = "lazy";
    figure.append(image);
    body.append(figure);
  }

  const teaser = cleanTeaser(item.summary);
  const paragraphs = item.content?.length ? item.content : teaser ? [teaser] : [];
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    body.append(paragraph);
  }

  const meta = [fmtDate(item.date), "NASA Science", ...item.categories.slice(0, 2)].join(" · ");
  openReader(
    "Notizia spaziale",
    item.title,
    meta,
    body,
    item.content?.length
      ? `Articolo NASA Science salvato nel sito il ${fmtDate(feed.fetchedAt)}: la lettura non lascia la pagina.`
      : "Anteprima dal feed NASA Science: il testo integrale non è disponibile nella copia locale.",
  );
}

function openObjectReader(object: SkyObject): void {
  const photo = photoById.get(object.id);
  const solar =
    object.kind === "planet" || object.kind === "moon" || object.kind === "sun" ? (object as SolarBody) : null;
  const body = document.createElement("div");
  body.className = "reader-text";

  if (photo) {
    const figure = document.createElement("figure");
    figure.className = "reader-figure";
    const image = document.createElement("img");
    image.src = photo.file;
    image.alt = `${object.name} — immagine ${photo.telescope}`;
    const caption = document.createElement("figcaption");
    caption.textContent = `${photo.telescope} · ${photo.credit}`;
    figure.append(image, caption);
    body.append(figure);
  }

  const description = document.createElement("p");
  description.textContent = object.description;
  body.append(description);

  if (solar) body.append(factsList(solar.facts));

  const extra: Array<{ label: string; value: string }> = [
    { label: "Posizione di oggi", value: `RA ${raLabel(object.ra)} · Dec ${decLabel(object.dec)}` },
    { label: "Distanza dalla Terra", value: object.distance },
  ];

  if (photo) {
    extra.push(
      { label: "Telescopio", value: photo.telescope },
      { label: "Data", value: photo.date },
      { label: "Credito", value: photo.credit },
      { label: "Archivio", value: `NASA images · ${photo.nasaId}` },
      { label: "Titolo originale", value: photo.nasaTitle },
    );
  }

  body.append(factsList(extra));

  openReader(
    solar ? "Corpo del sistema solare" : "Oggetto del cielo profondo",
    object.name,
    `${KIND_LABEL[object.kind]} · ${object.distance}`,
    body,
    solar
      ? "Scheda e dati calcolati nel sito: nessun collegamento esterno viene aperto."
      : "Immagine e dati dall'archivio NASA, salvati nel sito: la lettura non lascia la pagina.",
  );
}

/* ---------- ricerca ---------- */

let searchHits: SkyObject[] = [];
let activeHit = -1;

function setSearchOpen(open: boolean): void {
  searchResults.hidden = !open;
  searchInput.setAttribute("aria-expanded", String(open));
}

function closeSearch(): void {
  setSearchOpen(false);
  activeHit = -1;
}

function highlightHit(index: number): void {
  activeHit = index;
  Array.from(searchResults.children).forEach((child, i) => child.classList.toggle("is-active", i === index));
  (searchResults.children[index] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
}

function chooseObject(object: SkyObject): void {
  searchInput.value = object.name;
  selectObject(object.id, { scroll: true });
}

function renderSearch(query: string): void {
  const trimmed = query.trim();
  searchResults.textContent = "";
  searchHits = trimmed ? searchSky(searchIndex, trimmed, 6) : [];
  activeHit = -1;

  if (!trimmed) {
    closeSearch();
    return;
  }

  if (!searchHits.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = `Nessun corpo celeste per «${trimmed}».`;
    searchResults.append(empty);
    setSearchOpen(true);
    return;
  }

  searchHits.forEach((object, index) => {
    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = "search-hit";
    hit.setAttribute("role", "option");
    hit.dataset.id = object.id;

    const name = document.createElement("span");
    name.className = "search-hit-name";
    name.textContent = object.name;

    const kind = document.createElement("span");
    kind.className = "search-hit-kind";
    kind.textContent = KIND_LABEL[object.kind];

    const meta = document.createElement("span");
    meta.className = "search-hit-meta";
    meta.textContent = object.distance;

    hit.append(name, kind, meta);
    hit.addEventListener("click", () => chooseObject(object));
    hit.addEventListener("pointerenter", () => highlightHit(index));
    searchResults.append(hit);
  });

  setSearchOpen(true);
}

searchInput.addEventListener("input", () => renderSearch(searchInput.value));
searchInput.addEventListener("focus", () => {
  if (searchInput.value.trim()) renderSearch(searchInput.value);
});
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    searchInput.value = "";
    closeSearch();
    searchInput.blur();
    return;
  }
  if (!searchHits.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightHit((activeHit + 1) % searchHits.length);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightHit((activeHit - 1 + searchHits.length) % searchHits.length);
  } else if (event.key === "Enter") {
    event.preventDefault();
    chooseObject(searchHits[activeHit >= 0 ? activeHit : 0]);
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!(event.target as HTMLElement).closest(".search")) closeSearch();
});

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
  const shortcut = event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
  if (typing || !shortcut) return;
  event.preventDefault();
  searchInput.focus();
  searchInput.select();
});

const sky = new SkyView(
  canvas,
  labelLayer,
  ALL_OBJECTS.filter((object) => !(object as SolarBody).observer).map<SkyTarget>((object) => ({
    id: object.id,
    name: object.name,
    kind: object.kind,
    ra: object.ra,
    dec: object.dec,
    image: photoById.get(object.id)?.file,
  })),
  {
    onSelect: (id) => selectObject(id, { scroll: true }),
    onHover: (id) => hoverObject(id),
  },
);

renderNews();
renderGallery();
renderChips();
void refreshLivePhotos(false);
void loadLiveNews().then((items) => {
  if (!items || !items.length) return;
  feed.items = items.map((item) => ({ ...item, content: [] }));
  renderNews();
  $<HTMLSpanElement>("#source-note").textContent =
    `Notizie: ${feed.source}, lette dal feed oggi. Foto: archivio NASA e banca dati live. ` +
    `Pianeti: posizioni calcolate per oggi. Mappa: stelle reali, 89 costellazioni e catalogo Messier.`;
});

tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab ?? "news")));
$<HTMLButtonElement>("#zoom-in").addEventListener("click", () => sky.zoom(-8));
$<HTMLButtonElement>("#zoom-out").addEventListener("click", () => sky.zoom(8));
const constellationToggle = $<HTMLButtonElement>("#toggle-constellations");
constellationToggle.addEventListener("click", () => {
  const next = constellationToggle.getAttribute("aria-pressed") !== "true";
  constellationToggle.setAttribute("aria-pressed", String(next));
  constellationToggle.classList.toggle("is-on", next);
  sky.setConstellations(next);
});
$<HTMLButtonElement>("#refresh-photos").addEventListener("click", () => {
  void refreshLivePhotos(true);
});
$<HTMLButtonElement>("#reset").addEventListener("click", () => {
  sky.clearFocus();
  setActiveCard(null);
  hideDetail();
  searchInput.value = "";
  closeSearch();
});
$<HTMLButtonElement>("#detail-close").addEventListener("click", hideDetail);
$<HTMLButtonElement>("#detail-source").addEventListener("click", () => {
  if (currentObject) openObjectReader(currentObject);
});
$<HTMLButtonElement>("#reader-close").addEventListener("click", closeReader);
$<HTMLElement>("#reader-scrim").addEventListener("click", closeReader);
window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !reader.hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeReader();
    }
  },
  true,
);

window.setInterval(() => {
  const { ra, dec } = sky.getViewCenter();
  hudCoords.textContent = `RA ${raLabel(ra)} · Dec ${decLabel(dec)}`;
}, 220);

// la vista parte da Orione ma senza scheda aperta
