import A, { type AladinCatalog, type AladinInstance, type AladinOverlay } from "aladin-lite";
import type { Kind } from "../data/objects";
import { KIND_COLOR } from "./colors";

/** Un punto del cielo con nome, mostrato sulla mappa come marker con etichetta. */
export interface SkyMarker {
  id: string;
  name: string;
  kind: Kind;
  /** Ascensione retta in ore. */
  ra: number;
  /** Declinazione in gradi. */
  dec: number;
}

export interface Constellation {
  id: string;
  name: string;
  ra: number;
  dec: number;
  /** Polilinee in [RA ore, Dec gradi]. */
  lines: Array<Array<[number, number]>>;
}

export type SurveyId = "auto" | "wide" | "dss" | "panstarrs" | "2mass";

interface SurveySource {
  id: Exclude<SurveyId, "auto">;
  label: string;
  /** Server HiPS in ordine di preferenza: si usa il primo che risponde. */
  urls: string[];
}

const SURVEY_SOURCES: SurveySource[] = [
  { id: "wide", label: "Cielo intero (Mellinger)", urls: ["https://alasky.cds.unistra.fr/MellingerRGB"] },
  {
    id: "dss",
    label: "Ottico (DSS2)",
    urls: ["https://cdn.skies.esac.esa.int/DSSColor", "https://alasky.cds.unistra.fr/DSS/DSSColor"],
  },
  {
    id: "panstarrs",
    label: "Ottico profondo (Pan-STARRS)",
    urls: ["https://alasky.cds.unistra.fr/Pan-STARRS/DR1/color-z-zg-g"],
  },
  {
    id: "2mass",
    label: "Infrarosso (2MASS)",
    urls: ["https://cdn.skies.esac.esa.int/2MASSColor", "https://alaskybis.cds.unistra.fr/2MASS/Color"],
  },
];

async function reachable(url: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/properties`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Per ogni survey sceglie il primo server raggiungibile; quelli irraggiungibili spariscono. */
async function resolveSurveys(): Promise<Map<SurveySource["id"], { label: string; url: string }>> {
  const found = await Promise.all(
    SURVEY_SOURCES.map(async (source) => {
      for (const url of source.urls) if (await reachable(url)) return { source, url };
      return null;
    }),
  );
  const map = new Map<SurveySource["id"], { label: string; url: string }>();
  for (const entry of found) if (entry) map.set(entry.source.id, { label: entry.source.label, url: entry.url });
  return map;
}


/** Campo visivo in gradi con cui inquadrare ogni oggetto. */
const FOCUS_FOV: Record<string, number> = {
  andromeda: 4,
  pleiades: 2.5,
  "galactic-center": 12,
  carina: 3,
  tarantula: 1,
  hudf: 0.08,
  orion: 1.2,
  sun: 4,
  moon: 2.5,
};
const KIND_FOV: Partial<Record<Kind, number>> = {
  planet: 1,
  dwarf: 0.3,
  asteroid: 0.3,
  comet: 0.3,
  probe: 2,
  star: 1.5,
  galaxy: 0.6,
  cluster: 1,
  nebula: 1,
  remnant: 0.5,
};

/**
 * Proiezione stereografica: come nei planetari, il cielo riempie sempre tutto lo schermo
 * (con la proiezione ortografica, allontanandosi, diventava un globo su sfondo nero).
 */
const PROJECTION = "STG";
/** Campo massimo sul lato più lungo dello schermo: oltre, la stereografica deforma troppo i bordi. */
export const MAX_FOV = 150;
const MIN_FOV = 1 / 3600;
const START = { ra: 83.82, dec: -5.39, fov: 100 };
/** Sotto questo campo il cielo intero (Mellinger) diventa sgranato: si passa a DSS2. */
const AUTO_DEEP_BELOW = 22;
const AUTO_WIDE_ABOVE = 30;

function dotShape(color: string, size: number, ring: boolean): HTMLCanvasElement {
  const ratio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);
  const c = size / 2;
  if (ring) {
    // anello sottile con un alone morbido all'interno
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c - 1.5);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.7, "rgba(255,255,255,0)");
    glow.addColorStop(1, `${color}55`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c, c, c - 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // disco luminoso con nucleo bianco, come un pianeta visto al telescopio
    const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, "#ffffff");
    glow.addColorStop(0.22, color);
    glow.addColorStop(0.45, `${color}66`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function emptyShape(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  return canvas;
}

export class SkyMap {
  private aladin!: AladinInstance;
  private solar!: AladinCatalog;
  private famous!: AladinCatalog;
  private messier!: AladinCatalog;
  private famousMarkers: SkyMarker[] = [];
  private messierMarkers: SkyMarker[] = [];
  private constellationNames!: AladinCatalog;
  private starNames!: AladinCatalog;
  private constellationLines!: AladinOverlay;
  private survey: SurveyId = "auto";
  private activeLayer = "";
  private surveys = new Map<SurveySource["id"], { label: string; url: string }>();
  private showConstellations = true;
  private filter: Kind | null = null;
  private readonly markers = new Map<string, SkyMarker>();

  onSelect: (id: string) => void = () => {};
  onMove: (view: { ra: number; dec: number; fov: number }) => void = () => {};
  /** L'utente continua ad allontanarsi pur essendo già al campo massimo. */
  onZoomLimit: () => void = () => {};

  private constructor(private readonly host: HTMLElement) {}

  static async create(
    host: HTMLElement,
    solar: SkyMarker[],
    deepsky: { famous: SkyMarker[]; messier: SkyMarker[] },
    constellations: Constellation[],
    stars: SkyMarker[],
  ): Promise<SkyMap> {
    const [, surveys] = await Promise.all([A.init, resolveSurveys()]);
    if (!surveys.size) throw new Error("Nessun server di immagini del cielo raggiungibile");
    const map = new SkyMap(host);
    map.surveys = surveys;
    map.build(solar, deepsky, constellations, stars);
    return map;
  }

  private build(
    solar: SkyMarker[],
    deepsky: { famous: SkyMarker[]; messier: SkyMarker[] },
    constellations: Constellation[],
    stars: SkyMarker[],
  ): void {
    const first = this.layerFor(Math.min(START.fov, this.maxFov()));
    this.aladin = A.aladin(this.host, {
      survey: first,
      target: `${START.ra} ${START.dec}`,
      fov: Math.min(START.fov, this.maxFov()),
      projection: PROJECTION,
      cooFrame: "ICRSd",
      backgroundColor: "rgb(3, 4, 10)",
      showReticle: false,
      showZoomControl: false,
      showLayersControl: false,
      showFullscreenControl: false,
      showGotoControl: false,
      showSimbadPointerControl: false,
      showCooGridControl: false,
      showSettingsControl: false,
      showShareControl: false,
      showProjectionControl: false,
      showFrame: false,
      showFov: false,
      showCooLocation: false,
      showStatusBar: false,
      showContextMenu: false,
      log: false,
      samp: false,
    });
    this.activeLayer = first;
    this.aladin.setFoVRange(MIN_FOV, this.maxFov());
    window.addEventListener("resize", () => this.aladin.setFoVRange(MIN_FOV, this.maxFov()));

    // costellazioni: linee tenui e nomi senza simbolo
    this.constellationLines = A.graphicOverlay({ name: "Costellazioni", color: "rgba(150, 190, 255, 0.42)", lineWidth: 1.2 });
    this.aladin.addOverlay(this.constellationLines);
    for (const c of constellations) {
      for (const line of c.lines) {
        this.constellationLines.add(A.polyline(line.map(([ra, dec]) => [ra * 15, dec] as [number, number])));
      }
    }
    this.constellationNames = A.catalog({
      name: "Nomi costellazioni",
      shape: emptyShape(),
      // Aladin disegna anche un cerchio di selezione di raggio size/2 − 2: non può essere più piccolo
      sourceSize: 8,
      displayLabel: true,
      labelColumn: "name",
      labelColor: "rgba(175, 205, 255, 0.62)",
      labelFont: "italic 500 12px Inter, system-ui, sans-serif",
      onClick: () => {},
    });
    this.aladin.addCatalog(this.constellationNames);
    this.constellationNames.addSources(constellations.map((c) => A.source(c.ra * 15, c.dec, { name: c.name.toUpperCase() })));

    // nomi delle stelle più note, appena sopra la stella
    this.starNames = A.catalog({
      name: "Stelle",
      color: "#fff1d6",
      sourceSize: 10,
      shape: dotShape("#fff1d6", 10, true),
      displayLabel: true,
      labelColumn: "name",
      labelColor: "rgba(255, 241, 214, 0.78)",
      labelFont: "500 11.5px Inter, system-ui, sans-serif",
      onClick: () => {},
    });
    this.aladin.addCatalog(this.starNames);
    this.addMarkers(this.starNames, stars);

    // cielo profondo: anello colorato secondo il tipo. Il catalogo Messier compare solo da vicino.
    this.famousMarkers = deepsky.famous;
    this.messierMarkers = deepsky.messier;
    this.messier = this.markerCatalog("Messier", "#c8d4ff", 10, true, "11px Inter, system-ui, sans-serif");
    this.addMarkers(this.messier, deepsky.messier);
    this.famous = this.markerCatalog("Oggetti celebri", "#c8d4ff", 14, true, "600 12.5px Inter, system-ui, sans-serif");
    this.addMarkers(this.famous, deepsky.famous);

    // Sole, Luna e pianeti: sempre visibili, sopra tutto
    this.solar = this.markerCatalog("Sistema solare", "#ffd27a", 18, false, "600 13px Inter, system-ui, sans-serif");
    this.addMarkers(this.solar, solar);

    this.aladin.on("objectClicked", (object: { data?: { id?: string } } | null) => {
      const id = object?.data?.id;
      if (id && this.markers.has(id)) this.onSelect(id);
    });
    this.aladin.on("positionChanged", () => this.emitMove());
    this.aladin.on("zoomChanged", () => {
      this.updateLayers();
      this.emitMove();
    });
    // al campo massimo, altri giri di rotella verso l'esterno portano nell'Universo 3D
    let pushes = 0;
    this.host.addEventListener(
      "wheel",
      (event) => {
        if (event.deltaY <= 0 || !this.isAtWidest()) {
          pushes = 0;
          return;
        }
        if (++pushes >= 3) {
          pushes = 0;
          this.onZoomLimit();
        }
      },
      { passive: true },
    );
    this.updateLayers();
    this.emitMove();
  }

  private markerCatalog(name: string, color: string, size: number, ring: boolean, font: string): AladinCatalog {
    const shapes = new Map<string, HTMLCanvasElement>();
    const catalog = A.catalog({
      name,
      color,
      sourceSize: size,
      shape: (source) => {
        const tint = (source.data.color as string) ?? color;
        if (!shapes.has(tint)) shapes.set(tint, dotShape(tint, size, ring));
        return shapes.get(tint);
      },
      displayLabel: true,
      labelColumn: "name",
      labelFont: font,
      onClick: () => {},
    });
    this.aladin.addCatalog(catalog);
    return catalog;
  }

  private addMarkers(catalog: AladinCatalog, markers: SkyMarker[]): void {
    catalog.addSources(
      markers.map((m) => {
        this.markers.set(m.id, m);
        return A.source(m.ra * 15, m.dec, { id: m.id, name: m.name, kind: m.kind, color: KIND_COLOR[m.kind] });
      }),
    );
  }

  private fov(): number {
    const [w, h] = this.aladin.getFov();
    return Math.max(w, h);
  }

  private emitMove(): void {
    const [ra, dec] = this.aladin.getRaDec();
    this.onMove({ ra: ra / 15, dec, fov: this.fov() });
  }

  /** Mostra i livelli adatti al campo visivo: meno etichette quando si guarda tutto il cielo. */
  private updateLayers(): void {
    const fov = this.fov();

    if (this.survey === "auto") {
      if (fov < AUTO_DEEP_BELOW || fov > AUTO_WIDE_ABOVE) this.setLayer(this.layerFor(fov));
    }

    const lines = this.showConstellations && fov > 3;
    if (lines !== this.constellationLines.isShowing) lines ? this.constellationLines.show() : this.constellationLines.hide();
    const names = this.showConstellations && fov > 12;
    if (names !== this.constellationNames.isShowing) names ? this.constellationNames.show() : this.constellationNames.hide();

    const messier = fov < 35 || this.filter !== null;
    if (messier !== this.messier.isShowing) messier ? this.messier.show() : this.messier.hide();
    const stars = fov < 120 && this.filter === null;
    if (stars !== this.starNames.isShowing) stars ? this.starNames.show() : this.starNames.hide();
  }

  /** Survey automatica: Mellinger per il cielo intero, DSS2 da vicino (o l'unica disponibile). */
  private layerFor(fov: number): string {
    const wide = this.surveys.get("wide")?.url;
    const deep = this.surveys.get("dss")?.url ?? this.surveys.get("panstarrs")?.url;
    const any = [...this.surveys.values()][0].url;
    return (fov >= AUTO_DEEP_BELOW ? wide ?? deep : deep ?? wide) ?? any;
  }

  /** Survey selezionabili, nell'ordine del menu. */
  availableSurveys(): Array<{ id: SurveyId; label: string }> {
    return [{ id: "auto", label: "Automatico" }, ...[...this.surveys].map(([id, s]) => ({ id, label: s.label }))];
  }

  private setLayer(id: string): void {
    if (this.activeLayer === id) return;
    this.activeLayer = id;
    this.aladin.setBaseImageLayer(id);
  }

  setSurvey(id: SurveyId): void {
    this.survey = id;
    if (id === "auto") this.setLayer(this.layerFor(this.fov()));
    else {
      const url = this.surveys.get(id)?.url;
      if (url) this.setLayer(url);
    }
    this.updateLayers();
  }

  setConstellations(on: boolean): void {
    this.showConstellations = on;
    this.updateLayers();
  }

  /** Filtra i marker del cielo profondo per tipo (null = tutti). */
  setFilter(kind: Kind | null): void {
    this.filter = kind;
    const pick = (list: SkyMarker[]) => (kind ? list.filter((m) => m.kind === kind) : list);
    this.famous.removeAll();
    this.addMarkers(this.famous, pick(this.famousMarkers));
    this.messier.removeAll();
    this.addMarkers(this.messier, pick(this.messierMarkers));
    this.updateLayers();
  }

  /** Vola sull'oggetto; se non ha un marker sulla mappa usa la posizione indicata. */
  focus(id: string, fallback?: { ra: number; dec: number; kind: Kind }): void {
    const marker = this.markers.get(id) ?? (fallback ? { ...fallback } : undefined);
    if (!marker) return;
    const fov = FOCUS_FOV[id] ?? KIND_FOV[marker.kind] ?? 1;
    this.flyTo(marker.ra * 15, marker.dec, fov);
  }

  /** Campo massimo orizzontale (quello che Aladin limita): sugli schermi verticali è più stretto. */
  private maxFov(): number {
    const ratio = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    return MAX_FOV * Math.min(1, ratio);
  }

  isAtWidest(): boolean {
    return this.aladin.getFov()[0] >= this.maxFov() * 0.97;
  }

  /** Vola su una posizione: prima si allarga se il bersaglio è lontano, poi si stringe. */
  flyTo(raDeg: number, dec: number, fov: number): void {
    this.aladin.animateToRaDec(raDeg, dec, 2);
    this.aladin.zoomToFoV(fov, 2.4);
  }

  /** Risolve un nome qualunque con Sesame (CDS) e ci vola sopra. */
  resolve(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const [ra, dec] = this.aladin.getRaDec();
      const fov = this.fov();
      this.aladin.gotoObject(name, {
        success: ([targetRa, targetDec]) => {
          // gotoObject salta subito: si torna indietro e si anima il volo
          this.aladin.gotoRaDec(ra, dec);
          this.aladin.setFoV(fov);
          this.flyTo(targetRa, targetDec, 0.5);
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  zoomIn(): void {
    this.aladin.increaseZoom();
  }

  zoomOut(): void {
    if (this.isAtWidest()) this.onZoomLimit();
    else this.aladin.decreaseZoom();
  }

  reset(): void {
    this.flyTo(START.ra, START.dec, Math.min(START.fov, this.maxFov()));
  }
}
