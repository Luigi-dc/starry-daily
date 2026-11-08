/** Tipi minimi per la parte di Aladin Lite v3 usata dal sito (il pacchetto non li fornisce). */
declare module "aladin-lite" {
  export interface AladinSource {
    ra: number;
    dec: number;
    data: Record<string, unknown>;
  }

  export interface AladinCatalog {
    addSources(sources: AladinSource | AladinSource[]): void;
    removeAll(): void;
    show(): void;
    hide(): void;
    isShowing: boolean;
  }

  export interface AladinOverlay {
    add(shape: unknown): void;
    show(): void;
    hide(): void;
    isShowing: boolean;
  }

  export interface AladinCatalogOptions {
    name?: string;
    shape?: string | HTMLCanvasElement | HTMLImageElement | ((source: AladinSource) => HTMLCanvasElement | void);
    sourceSize?: number;
    color?: string;
    hoverColor?: string;
    selectionColor?: string;
    displayLabel?: boolean;
    labelColumn?: string;
    labelColor?: string;
    labelFont?: string;
    onClick?: string | ((source: AladinSource) => void);
  }

  export interface AladinInstance {
    gotoRaDec(ra: number, dec: number): void;
    gotoObject(name: string, callbacks?: { success?: (raDec: [number, number]) => void; error?: () => void }): void;
    animateToRaDec(ra: number, dec: number, durationSeconds?: number, complete?: () => void): void;
    zoomToFoV(fov: number, durationSeconds?: number, complete?: () => void): void;
    setFoV(fov: number): void;
    getFov(): [number, number];
    getRaDec(): [number, number];
    increaseZoom(): void;
    decreaseZoom(): void;
    setBaseImageLayer(idOrUrl: string): void;
    addCatalog(catalog: AladinCatalog): void;
    addOverlay(overlay: AladinOverlay): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  interface AladinStatic {
    init: Promise<void>;
    aladin(target: string | HTMLElement, options?: Record<string, unknown>): AladinInstance;
    catalog(options?: AladinCatalogOptions): AladinCatalog;
    source(ra: number, dec: number, data?: Record<string, unknown>): AladinSource;
    graphicOverlay(options?: { color?: string; lineWidth?: number; name?: string }): AladinOverlay;
    polyline(points: Array<[number, number]>, options?: { color?: string; lineWidth?: number }): unknown;
  }

  const A: AladinStatic;
  export default A;
}
