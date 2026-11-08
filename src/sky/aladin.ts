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
const KIND_FOV: Partial<Record<Kind, number>> = { planet: 1, galaxy: 0.6, cluster: 1, nebula: 1, remnant: 0.5 };

const START = { ra: 83.82, dec: -5.39, fov: 70 };
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
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ring) {
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.arc(c, c, c / 2.4, 0, Math.PI * 2);
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
  private constellationLines!: AladinOverlay;
  private survey: SurveyId = "auto";
  private activeLayer = "";
  private surveys = new Map<SurveySource["id"], { label: string; url: string }>();
  private showConstellations = true;
  private filter: Kind | null = null;
  private readonly markers = new Map<string, SkyMarker>();

  onSelect: (id: string) => void = () => {};
  onMove: (view: { ra: number; dec: number; fov: number }) => void = () => {};

  private constructor(private readonly host: HTMLElement) {}

  static async create(
    host: HTMLElement,
    solar: SkyMarker[],
    deepsky: { famous: SkyMarker[]; messier: SkyMarker[] },
    constellations: Constellation[],
  ): Promise<SkyMap> {
    const [, surveys] = await Promise.all([A.init, resolveSurveys()]);
    if (!surveys.size) throw new Error("Nessun server di immagini del cielo raggiungibile");
    const map = new SkyMap(host);
    map.surveys = surveys;
    map.build(solar, deepsky, constellations);
    return map;
  }

  private build(
    solar: SkyMarker[],
    deepsky: { famous: SkyMarker[]; messier: SkyMarker[] },
    constellations: Constellation[],
  ): void {
    const first = this.layerFor(START.fov);
    this.aladin = A.aladin(this.host, {
      survey: first,
      target: `${START.ra} ${START.dec}`,
      fov: START.fov,
      projection: "SIN",
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

    // costellazioni: linee tenui e nomi senza simbolo
    this.constellationLines = A.graphicOverlay({ name: "Costellazioni", color: "rgba(140, 180, 255, 0.35)", lineWidth: 1 });
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
      labelColor: "rgba(170, 200, 255, 0.55)",
      labelFont: "italic 12px system-ui, sans-serif",
      onClick: () => {},
    });
    this.aladin.addCatalog(this.constellationNames);
    this.constellationNames.addSources(constellations.map((c) => A.source(c.ra * 15, c.dec, { name: c.name.toUpperCase() })));

    // cielo profondo: anello colorato secondo il tipo. Il catalogo Messier compare solo da vicino.
    this.famousMarkers = deepsky.famous;
    this.messierMarkers = deepsky.messier;
    this.messier = this.markerCatalog("Messier", "#c8d4ff", 10, true, "11px system-ui, sans-serif");
    this.addMarkers(this.messier, deepsky.messier);
    this.famous = this.markerCatalog("Oggetti celebri", "#c8d4ff", 12, true, "500 12px system-ui, sans-serif");
    this.addMarkers(this.famous, deepsky.famous);

    // Sole, Luna e pianeti: sempre visibili, sopra tutto
    this.solar = this.markerCatalog("Sistema solare", "#ffd27a", 16, false, "600 13px system-ui, sans-serif");
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

  focus(id: string): void {
    const marker = this.markers.get(id);
    if (!marker) return;
    const fov = FOCUS_FOV[id] ?? KIND_FOV[marker.kind] ?? 1;
    this.flyTo(marker.ra * 15, marker.dec, fov);
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
    this.aladin.decreaseZoom();
  }

  reset(): void {
    this.flyTo(START.ra, START.dec, START.fov);
  }
}
