import "./style.css";
import { KIND_LABEL, OBJECTS, type Kind, type SkyObject } from "./data/objects";
import { SOLAR_BODIES, SOLAR_COMPUTED_AT, type SolarBody } from "./data/solar";
import { MINOR_BODIES, PROBES, moonBodies } from "./data/bodies";
import { COSMIC_OBJECTS } from "./data/galaxies";
import { NAMED_STARS } from "./data/stars";
import { REGIONS } from "./data/regions";
import deepskyJson from "./data/deepsky.json";
import textureCredits from "./data/texture-credits.json";
import { buildIndex, searchSky } from "./search";
import { KIND_COLOR } from "./sky/colors";
import type { Constellation, SkyMap, SkyMarker, SurveyId } from "./sky/aladin";
import type { UniverseInfo, UniverseView } from "./universe/scene";
import { loadNews, type NewsItem } from "./feeds/news";
import { loadApod, loadEpic, loadEsa, loadNasaImages, type SpacePhoto } from "./feeds/photos";
import { PhotoViewer } from "./ui/viewer";

/* ---------- catalogo ---------- */

const solarBodies = SOLAR_BODIES.filter((body) => !body.observer);
const earth = SOLAR_BODIES.find((body) => body.observer);
const famous = OBJECTS;
/** Il catalogo Messier ripete alcuni oggetti celebri: si tiene la scheda più ricca. */
const messier = (deepskyJson as { objects: SkyObject[] }).objects.filter(
  (m) => !famous.some((f) => Math.abs(f.ra - m.ra) * 15 * Math.cos((f.dec * Math.PI) / 180) < 0.2 && Math.abs(f.dec - m.dec) < 0.2),
);
const moons = moonBodies(new Map([...solarBodies, ...MINOR_BODIES].map((b) => [b.id, b])));
const deepObjects: SkyObject[] = [...famous, ...messier];
const allObjects: SkyObject[] = [
  ...solarBodies,
  ...(earth ? [earth] : []),
  ...MINOR_BODIES,
  ...moons,
  ...PROBES,
  ...NAMED_STARS,
  ...deepObjects,
  ...COSMIC_OBJECTS,
  ...REGIONS,
];
const objectById = new Map(allObjects.map((o) => [o.id, o]));
const searchIndex = buildIndex(allObjects);

const toMarker = (o: SkyObject): SkyMarker => ({ id: o.id, name: o.name, kind: o.kind, ra: o.ra, dec: o.dec });
const deepMarkers = { famous: famous.map(toMarker), messier: messier.map(toMarker) };
/** Sul cielo: Sole, Luna, pianeti, pianeti nani, comete e sonde. */
const skySolarMarkers = [...solarBodies, ...MINOR_BODIES, ...PROBES].map(toMarker);

/* ---------- utilità ---------- */

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const isSolar = (o: SkyObject): o is SolarBody => (o.kind === "planet" || o.kind === "moon" || o.kind === "sun") && "tint" in o;
type WithExtras = SkyObject & { facts?: Array<{ label: string; value: string }>; link?: string; color?: string };

const dayFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

/** «2 ore fa», «ieri», «5 nov»: per le notizie conta quanto sono fresche. */
function ago(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  return dayFmt.format(date);
}

function photoDate(photo: SpacePhoto): string {
  const date = new Date(photo.date.length === 10 ? `${photo.date}T12:00:00Z` : photo.date);
  return Number.isNaN(date.getTime()) ? "" : dayFmt.format(date);
}

const raLabel = (hours: number) => {
  const total = Math.round((((hours % 24) + 24) % 24) * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}h ${String(total % 60).padStart(2, "0")}m`;
};
const decLabel = (deg: number) => `${deg >= 0 ? "+" : "−"}${Math.abs(deg).toFixed(1)}°`;
const fovLabel = (fov: number) =>
  fov >= 1 ? `campo ${fov.toFixed(fov < 10 ? 1 : 0)}°` : fov >= 1 / 60 ? `campo ${(fov * 60).toFixed(1)}′` : `campo ${(fov * 3600).toFixed(0)}″`;

$("#today").textContent = longDayFmt.format(new Date());

/* ---------- mappa del cielo ---------- */

let sky: SkyMap | null = null;
const loading = $<HTMLDivElement>("#sky-loading");

async function startSky(): Promise<void> {
  try {
    const [{ SkyMap }, skyData] = await Promise.all([import("./sky/aladin"), import("./data/sky.json")]);
    const constellations = (skyData.default as unknown as { constellations: Constellation[] }).constellations;
    sky = await SkyMap.create($("#sky"), skySolarMarkers, deepMarkers, constellations, NAMED_STARS.filter((star) => star.mag <= 2.6).map(toMarker));
    sky.onSelect = (id) => selectObject(id);
    sky.onZoomLimit = () => showLaunch();
    sky.onMove = ({ ra, dec, fov }) => {
      $("#hud-coords").textContent = `RA ${raLabel(ra)} · Dec ${decLabel(dec)}`;
      $("#hud-fov").textContent = fovLabel(fov);
    };
    const select = $<HTMLSelectElement>("#survey");
    for (const survey of sky.availableSurveys()) select.append(new Option(survey.label, survey.id));
    select.addEventListener("change", () => sky?.setSurvey(select.value as SurveyId));
    loading.hidden = true;
  } catch (error) {
    console.error(error);
    $("#sky-loading-text").textContent =
      "Il cielo non si è caricato: serve un browser con WebGL2 e la connessione ai server delle immagini. Riprova più tardi.";
    loading.classList.add("is-error");
  }
}

const FILTERS: Array<{ kind: Kind | null; label: string }> = [
  { kind: null, label: "Tutto" },
  { kind: "nebula", label: "Nebulose" },
  { kind: "galaxy", label: "Galassie" },
  { kind: "cluster", label: "Ammassi" },
  { kind: "remnant", label: "Supernovae" },
];

function renderChips(): void {
  const chips = $("#kind-chips");
  for (const filter of FILTERS) {
    const chip = el("button", "chip", filter.label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", String(filter.kind === null));
    if (filter.kind) chip.style.setProperty("--chip", KIND_COLOR[filter.kind]);
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");
      sky?.setFilter(filter.kind);
    });
    chips.append(chip);
  }
}

/* ---------- scheda dell'oggetto ---------- */

const detail = $<HTMLElement>("#detail");
const planetCanvas = $<HTMLCanvasElement>("#detail-planet");
let planetView: { show(id: string, color?: string): boolean; hide(): void } | null = null;
let detailId: string | null = null;

/** Corpi con una superficie 3D disegnata nella scheda. */
const GLOBE_KINDS = new Set<Kind>(["planet", "moon", "sun", "dwarf", "asteroid"]);

const CREDITS = textureCredits as Record<string, { credit: string }>;

async function showPlanet(id: string, color: string): Promise<void> {
  const { PlanetView } = await import("./three/planet");
  planetView ??= new PlanetView(planetCanvas);
  if (detailId === id) planetCanvas.hidden = !planetView.show(id, color);
}

function showDetail(o: SkyObject): void {
  const extra = o as WithExtras;
  const media = $<HTMLDivElement>("#detail-media");
  const badge = $("#detail-badge");
  const facts = $<HTMLDListElement>("#detail-facts");
  detailId = o.id;

  planetView?.hide();
  planetCanvas.hidden = true;
  media.hidden = !GLOBE_KINDS.has(o.kind);
  media.style.removeProperty("--orb-a");
  media.style.removeProperty("--orb-b");

  if (GLOBE_KINDS.has(o.kind)) {
    const tint = isSolar(o) ? o.tint : [extra.color ?? "#cccccc", "#222222"];
    media.style.setProperty("--orb-a", tint[0]);
    media.style.setProperty("--orb-b", tint[1]);
    badge.textContent = `Posizione del ${dayFmt.format(SOLAR_COMPUTED_AT)}`;
    const credit = CREDITS[o.id]?.credit;
    $("#detail-credit").textContent = credit
      ? `Mappa: ${credit}`
      : "Mai fotografato da vicino: nessuna mappa della superficie, solo il colore medio osservato.";
    void showPlanet(o.id, tint[0]);
  }

  facts.textContent = "";
  facts.hidden = !extra.facts?.length;
  for (const entry of extra.facts ?? []) facts.append(el("dt", "", entry.label), el("dd", "", entry.value));

  const observer = o.id === "earth";
  const region = o.kind === "structure" && REGIONS.some((r) => r.id === o.id);
  $("#detail-kind").textContent =
    observer || region ? KIND_LABEL[o.kind] : `${KIND_LABEL[o.kind]} · RA ${raLabel(o.ra)} · Dec ${decLabel(o.dec)}`;
  $("#detail-name").textContent = o.name;
  $("#detail-meta").textContent = o.distance;
  $("#detail-desc").textContent = o.description;

  const link = $<HTMLAnchorElement>("#detail-link");
  link.hidden = !extra.link;
  if (extra.link) {
    link.href = extra.link;
    link.textContent = extra.link.includes("esa.int") ? "Scheda ESA ↗" : "Scheda NASA ↗";
  }
  $("#detail-to-universe").hidden = mode === "universe" || !universeKnows(o.id);
  $("#detail-to-sky").hidden = mode === "sky" || observer || region;
  detail.hidden = false;
}

function hideDetail(): void {
  detail.hidden = true;
  detailId = null;
  planetView?.hide();
}

function selectObject(id: string): void {
  const o = objectById.get(id);
  if (!o) return;
  if (mode === "sky" && id === "earth") {
    // la Terra non ha una direzione nel cielo: la si guarda dallo spazio
    void setMode("universe").then(() => universe?.focus(id));
  } else if (mode === "universe" && universe) {
    if (!universe.focus(id)) {
      // non è nello spazio 3D (per esempio un oggetto Messier senza distanza): si guarda dalla Terra
      void setMode("sky").then(() => sky?.focus(id, o));
    }
  } else {
    sky?.focus(id, o);
  }
  showDetail(o);
  closeSearch();
  setPanelOpen(false);
}

/* ---------- Universo 3D ---------- */

type Mode = "sky" | "universe";
let mode: Mode = "sky";
let universe: UniverseView | null = null;
let universeLoading: Promise<UniverseView | null> | null = null;
/** Oggetti che compaiono anche nello spazio 3D (tutti tranne il catalogo Messier). */
const messierIds = new Set(messier.map((m) => m.id));
const universeKnows = (id: string) => objectById.has(id) && !messierIds.has(id) && id !== "hudf";

const LEVEL_CHIPS: Array<{ id: string; label: string }> = [
  { id: "planets", label: "Pianeti" },
  { id: "solar", label: "Sistema solare" },
  { id: "oort", label: "Nube di Oort" },
  { id: "stars", label: "Stelle vicine" },
  { id: "galaxy", label: "Via Lattea" },
  { id: "local", label: "Gruppo Locale" },
  { id: "cosmic", label: "Superammassi" },
  { id: "universe", label: "Universo osservabile" },
];

function renderScaleChips(): void {
  const chips = $("#scale-chips");
  for (const level of LEVEL_CHIPS) {
    const chip = el("button", "chip", level.label);
    chip.type = "button";
    chip.dataset.scale = level.id;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      hideDetail();
      universe?.goToScale(level.id);
    });
    chips.append(chip);
  }
}

function showUniverseInfo(info: UniverseInfo): void {
  $("#u-scale").textContent = info.scaleLabel;
  $("#u-scale-bar").style.width = `${Math.max(12, Math.min(160, info.scalePx))}px`;
  $("#u-level").textContent = info.level;
  $("#u-from-sun").textContent = info.fromSun;
  document.querySelectorAll<HTMLButtonElement>("#scale-chips .chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.scale === info.scaleId));
  });
}

async function loadUniverse(): Promise<UniverseView | null> {
  universeLoading ??= (async () => {
    loading.hidden = false;
    loading.classList.remove("is-error");
    $("#sky-loading-text").textContent = "Costruisco l'universo: 9.500 stelle, la Via Lattea, le galassie…";
    try {
      const { UniverseView } = await import("./universe/scene");
      const host = $<HTMLDivElement>("#universe");
      host.hidden = false;
      const view = new UniverseView(host);
      view.onSelect = (id) => {
        const o = objectById.get(id);
        if (o) showDetail(o);
      };
      view.onView = showUniverseInfo;
      view.focus("sun", true);
      view.goToScale("solar");
      universe = view;
      loading.hidden = true;
      return view;
    } catch (error) {
      console.error(error);
      $("#sky-loading-text").textContent = "L'Universo 3D non si è avviato: serve un browser con WebGL.";
      loading.classList.add("is-error");
      universeLoading = null;
      return null;
    }
  })();
  return universeLoading;
}

async function setMode(next: Mode): Promise<void> {
  if (next === mode && (next === "sky" || universe)) return;
  mode = next;
  document.body.dataset.mode = next;
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    const active = btn.dataset.mode === next;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  hideLaunch();
  history.replaceState(null, "", next === "universe" ? "#universo" : location.pathname + location.search);
  const host = $<HTMLDivElement>("#universe");
  if (next === "universe") {
    const view = await loadUniverse();
    if (!view || mode !== "universe") return;
    host.hidden = false;
    view.show();
  } else {
    universe?.hide();
    host.hidden = true;
    if (!sky && !loading.classList.contains("is-error")) $("#sky-loading-text").textContent = "Carico il cielo…";
    loading.hidden = !!sky;
  }
  if (detailId) {
    const o = objectById.get(detailId);
    if (o) showDetail(o);
  }
}

let launchTimer = 0;
function showLaunch(): void {
  const btn = $<HTMLButtonElement>("#to-universe");
  btn.hidden = false;
  window.clearTimeout(launchTimer);
  launchTimer = window.setTimeout(hideLaunch, 7000);
}
function hideLaunch(): void {
  $<HTMLButtonElement>("#to-universe").hidden = true;
}

/* ---------- ricerca ---------- */

const searchInput = $<HTMLInputElement>("#search-input");
const searchResults = $<HTMLDivElement>("#search-results");
type Hit = { object: SkyObject } | { query: string };
let hits: Hit[] = [];
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

async function chooseHit(hit: Hit): Promise<void> {
  if ("object" in hit) {
    searchInput.value = hit.object.name;
    selectObject(hit.object.id);
    return;
  }
  closeSearch();
  hideDetail();
  if (mode === "universe") await setMode("sky");
  if (!sky) return;
  searchInput.disabled = true;
  const found = await sky.resolve(hit.query);
  searchInput.disabled = false;
  if (found) setPanelOpen(false);
  else {
    searchResults.textContent = "";
    searchResults.append(el("p", "search-empty", `«${hit.query}» non trovato nei cataloghi astronomici.`));
    setSearchOpen(true);
  }
}

function renderSearch(): void {
  const query = searchInput.value.trim();
  searchResults.textContent = "";
  activeHit = -1;
  if (!query) {
    hits = [];
    closeSearch();
    return;
  }

  hits = searchSky(searchIndex, query, 6).map((object) => ({ object }));
  if (query.length >= 2) hits.push({ query });

  hits.forEach((hit, index) => {
    const row = el("button", "search-hit");
    row.type = "button";
    row.setAttribute("role", "option");
    if ("object" in hit) {
      const dot = el("span", "search-dot");
      dot.style.background = KIND_COLOR[hit.object.kind];
      row.append(dot, el("span", "search-hit-name", hit.object.name), el("span", "search-hit-kind", KIND_LABEL[hit.object.kind]));
    } else {
      row.classList.add("search-hit--remote");
      row.append(el("span", "search-dot"), el("span", "search-hit-name", `Cerca «${hit.query}» in tutto il cielo`), el("span", "search-hit-kind", "Simbad"));
    }
    row.addEventListener("click", () => void chooseHit(hit));
    row.addEventListener("pointerenter", () => highlightHit(index));
    searchResults.append(row);
  });
  setSearchOpen(true);
}

searchInput.addEventListener("input", renderSearch);
searchInput.addEventListener("focus", () => searchInput.value.trim() && renderSearch());
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    searchInput.value = "";
    closeSearch();
    searchInput.blur();
  } else if (hits.length && event.key === "ArrowDown") {
    event.preventDefault();
    highlightHit((activeHit + 1) % hits.length);
  } else if (hits.length && event.key === "ArrowUp") {
    event.preventDefault();
    highlightHit((activeHit - 1 + hits.length) % hits.length);
  } else if (hits.length && event.key === "Enter") {
    event.preventDefault();
    void chooseHit(hits[Math.max(activeHit, 0)]);
  }
});
document.addEventListener("pointerdown", (event) => {
  if (!(event.target as HTMLElement).closest(".search")) closeSearch();
});

/* ---------- notizie ---------- */

const newsList = $<HTMLDivElement>("#news-list");

function skeleton(container: HTMLElement, count: number, className: string): void {
  container.textContent = "";
  for (let i = 0; i < count; i++) container.append(el("div", `skeleton ${className}`));
}

function failure(container: HTMLElement, message: string, retry: () => void): void {
  container.textContent = "";
  const box = el("div", "feed-error");
  const button = el("button", "pill-btn", "Riprova");
  button.type = "button";
  button.addEventListener("click", retry);
  box.append(el("p", "", message), button);
  container.append(box);
}

async function refreshNews(): Promise<void> {
  skeleton(newsList, 6, "skeleton-news");
  try {
    const items = await loadNews();
    newsList.textContent = "";
    for (const item of items) newsList.append(newsCard(item));
  } catch {
    failure(newsList, "Le fonti delle notizie non rispondono in questo momento.", () => void refreshNews());
  }
}

function newsCard(item: NewsItem): HTMLElement {
  const card = el("button", "news-card");
  card.type = "button";
  if (item.image) {
    const img = el("img", "news-img");
    img.src = item.image;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();
    card.append(img);
  }
  const text = el("div", "news-text");
  const meta = el("p", "news-meta");
  meta.append(el("span", "news-source", item.source), el("span", "", ago(item.date)));
  text.append(meta, el("h2", "news-title", item.title));
  card.append(text);
  card.addEventListener("click", () => openReader(item));
  return card;
}

const reader = $<HTMLElement>("#reader");
let readerReturn: HTMLElement | null = null;

function openReader(item: NewsItem): void {
  const img = $<HTMLImageElement>("#reader-img");
  img.hidden = !item.image;
  if (item.image) img.src = item.image;
  $("#reader-kicker").textContent = `${item.source} · ${ago(item.date)}`;
  $("#reader-title").textContent = item.title;
  $("#reader-summary").textContent = item.summary;
  const link = $<HTMLAnchorElement>("#reader-link");
  link.href = item.url;
  link.textContent = `Leggi l'articolo completo su ${item.source} ↗`;
  readerReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  reader.hidden = false;
  $<HTMLButtonElement>("#reader-close").focus();
}

function closeReader(): void {
  if (reader.hidden) return;
  reader.hidden = true;
  readerReturn?.focus();
}

/* ---------- foto dallo spazio ---------- */

const viewer = new PhotoViewer((photo) => [photoDate(photo), photo.credit].filter(Boolean).join(" · "));

const PHOTO_SOURCES: Record<string, { load: () => Promise<SpacePhoto[]>; skeletons: number; error: string }> = {
  apod: { load: loadApod, skeletons: 1, error: "La foto astronomica del giorno non è raggiungibile in questo momento." },
  epic: { load: loadEpic, skeletons: 4, error: "Le foto del satellite DSCOVR non sono raggiungibili." },
  esa: { load: loadEsa, skeletons: 4, error: "I comunicati ESA di Webb e Hubble non sono raggiungibili." },
  nasa: { load: loadNasaImages, skeletons: 6, error: "La libreria immagini NASA non risponde." },
};

function photoCard(photo: SpacePhoto, list: SpacePhoto[], index: number, hero: boolean): HTMLElement {
  const card = el("button", hero && index === 0 ? "photo-card photo-card--hero" : "photo-card");
  card.type = "button";
  card.setAttribute("aria-label", photo.title);
  const img = el("img");
  img.src = photo.thumb;
  img.alt = "";
  img.loading = "lazy";
  img.onerror = () => card.remove();
  const caption = el("span", "photo-caption");
  caption.append(el("span", "photo-title", photo.title), el("span", "photo-date", photo.video ? `${photoDate(photo)} · video` : photoDate(photo)));
  card.append(img, caption);
  card.addEventListener("click", () => viewer.open(list, index));
  return card;
}

async function refreshPhotos(key: string): Promise<void> {
  const source = PHOTO_SOURCES[key];
  const section = $<HTMLElement>(`.photo-section[data-source="${key}"]`);
  const feed = section.querySelector<HTMLElement>(".photo-feed")!;
  const hero = feed.classList.contains("photo-feed--hero");
  skeleton(feed, source.skeletons, hero ? "skeleton-hero" : "skeleton-photo");
  try {
    const photos = await source.load();
    if (!photos.length) throw new Error("vuoto");
    feed.textContent = "";
    photos.forEach((photo, i) => feed.append(photoCard(photo, photos, i, hero)));
  } catch {
    failure(feed, source.error, () => void refreshPhotos(key));
  }
}

let photosLoaded = false;
function loadPhotosOnce(): void {
  if (photosLoaded) return;
  photosLoaded = true;
  for (const key of Object.keys(PHOTO_SOURCES)) void refreshPhotos(key);
}

/* ---------- pannello e schede ---------- */

const panel = $<HTMLElement>("#panel");
const handle = $<HTMLButtonElement>("#panel-handle");

const newsToggle = $<HTMLButtonElement>("#news-toggle");
const panelScrim = $<HTMLDivElement>("#panel-scrim");

function setPanelOpen(open: boolean): void {
  panel.classList.toggle("is-open", open);
  handle.setAttribute("aria-expanded", String(open));
  newsToggle.setAttribute("aria-expanded", String(open));
  panelScrim.hidden = !open;
  if (open && document.querySelector(".tab.is-active")?.getAttribute("data-tab") === "photos") loadPhotosOnce();
}

function setTab(name: string): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>(".view").forEach((view) => {
    const active = view.id === `view-${name}`;
    view.classList.toggle("is-active", active);
    view.hidden = !active;
  });
  if (name === "photos") loadPhotosOnce();
}

document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) =>
  tab.addEventListener("click", () => setTab(tab.dataset.tab ?? "news")),
);
handle.addEventListener("click", () => setPanelOpen(!panel.classList.contains("is-open")));
newsToggle.addEventListener("click", () => setPanelOpen(!panel.classList.contains("is-open")));
$("#panel-close").addEventListener("click", () => setPanelOpen(false));
panelScrim.addEventListener("click", () => setPanelOpen(false));

/* ---------- comandi ---------- */

$("#zoom-in").addEventListener("click", () => (mode === "universe" ? universe?.zoomIn() : sky?.zoomIn()));
$("#zoom-out").addEventListener("click", () => (mode === "universe" ? universe?.zoomOut() : sky?.zoomOut()));
document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) =>
  btn.addEventListener("click", () => void setMode(btn.dataset.mode as Mode)),
);
$("#to-universe").addEventListener("click", () => void setMode("universe"));
$("#detail-to-universe").addEventListener("click", () => {
  const id = detailId;
  void setMode("universe").then(() => {
    if (id) universe?.focus(id);
  });
});
$("#detail-to-sky").addEventListener("click", () => {
  const o = detailId ? objectById.get(detailId) : undefined;
  void setMode("sky").then(() => {
    if (o) sky?.focus(o.id, o);
  });
});
const constellationBtn = $<HTMLButtonElement>("#toggle-constellations");
constellationBtn.addEventListener("click", () => {
  const on = constellationBtn.getAttribute("aria-pressed") !== "true";
  constellationBtn.setAttribute("aria-pressed", String(on));
  constellationBtn.classList.toggle("is-on", on);
  sky?.setConstellations(on);
});
$("#reset").addEventListener("click", () => {
  hideDetail();
  if (mode === "universe") universe?.goToScale("solar");
  else sky?.reset();
});
$("#detail-close").addEventListener("click", hideDetail);
$("#reader-close").addEventListener("click", closeReader);
$("#reader-scrim").addEventListener("click", closeReader);

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
  if (event.key === "Escape") {
    if (!reader.hidden) closeReader();
    else if (panel.classList.contains("is-open")) setPanelOpen(false);
    else if (!detail.hidden) hideDetail();
    return;
  }
  if (typing || viewer.isOpen) return;
  if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

/* ---------- avvio ---------- */

renderChips();
renderScaleChips();
void startSky();
// link diretto all'Universo 3D, anche a una scala precisa: #universo, #universo/galaxy…
if (location.hash.startsWith("#universo")) {
  const scale = location.hash.split("/")[1];
  void setMode("universe").then(() => {
    if (scale) universe?.goToScale(scale);
  });
}
void refreshNews();
// le foto si caricano quando si apre la scheda, oppure poco dopo l'avvio
window.setTimeout(loadPhotosOnce, 2500);
