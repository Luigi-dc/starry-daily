import type { SpacePhoto } from "../feeds/photos";

/**
 * Visore a schermo intero: zoom con rotella, pinch o doppio clic, trascinamento,
 * frecce per scorrere le foto della stessa sezione, Esc per chiudere.
 */
export class PhotoViewer {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly frame: HTMLIFrameElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly desc: HTMLElement;
  private readonly link: HTMLAnchorElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;

  private list: SpacePhoto[] = [];
  private index = 0;
  private scale = 1;
  private x = 0;
  private y = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { distance: number; scale: number } | null = null;
  private restoreFocus: HTMLElement | null = null;

  constructor(private readonly format: (photo: SpacePhoto) => string) {
    this.root = document.createElement("section");
    this.root.className = "viewer";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Foto a schermo intero");
    this.root.innerHTML = `
      <div class="viewer-stage">
        <img class="viewer-img" alt="" draggable="false" />
        <iframe class="viewer-frame" title="Video" allow="fullscreen; picture-in-picture" hidden></iframe>
      </div>
      <button class="viewer-btn viewer-close" type="button" aria-label="Chiudi">✕</button>
      <button class="viewer-btn viewer-prev" type="button" aria-label="Foto precedente">‹</button>
      <button class="viewer-btn viewer-next" type="button" aria-label="Foto successiva">›</button>
      <div class="viewer-zoom">
        <button class="viewer-btn" type="button" data-zoom="out" aria-label="Riduci">−</button>
        <button class="viewer-btn" type="button" data-zoom="fit" aria-label="Adatta">⤢</button>
        <button class="viewer-btn" type="button" data-zoom="in" aria-label="Ingrandisci">+</button>
      </div>
      <aside class="viewer-info">
        <h2 class="viewer-title"></h2>
        <p class="viewer-meta"></p>
        <p class="viewer-desc"></p>
        <a class="viewer-link" target="_blank" rel="noopener noreferrer">Fonte originale ↗</a>
      </aside>`;
    document.body.append(this.root);

    const q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T;
    this.stage = q(".viewer-stage");
    this.img = q(".viewer-img");
    this.frame = q(".viewer-frame");
    this.title = q(".viewer-title");
    this.meta = q(".viewer-meta");
    this.desc = q(".viewer-desc");
    this.link = q(".viewer-link");
    this.prev = q(".viewer-prev");
    this.next = q(".viewer-next");

    q<HTMLButtonElement>(".viewer-close").addEventListener("click", () => this.close());
    this.prev.addEventListener("click", () => this.step(-1));
    this.next.addEventListener("click", () => this.step(1));
    this.root.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const mode = btn.dataset.zoom;
        if (mode === "fit") this.resetView();
        else this.zoomAt(mode === "in" ? 1.6 : 1 / 1.6);
      }),
    );

    this.stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    this.stage.addEventListener("dblclick", (e) => {
      if (this.scale > 1.05) this.resetView();
      else this.zoomAt(2.5, e.clientX, e.clientY);
    });
    this.stage.addEventListener("pointerdown", (e) => this.pointerDown(e));
    this.stage.addEventListener("pointermove", (e) => this.pointerMove(e));
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = null;
    };
    this.stage.addEventListener("pointerup", up);
    this.stage.addEventListener("pointercancel", up);

    window.addEventListener("keydown", (e) => {
      if (this.root.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
      } else if (e.key === "ArrowLeft") this.step(-1);
      else if (e.key === "ArrowRight") this.step(1);
      else if (e.key === "+" || e.key === "=") this.zoomAt(1.4);
      else if (e.key === "-") this.zoomAt(1 / 1.4);
    }, true);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(list: SpacePhoto[], index: number): void {
    this.list = list;
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.root.hidden = false;
    document.body.classList.add("has-viewer");
    this.show(index);
    this.root.querySelector<HTMLButtonElement>(".viewer-close")?.focus();
  }

  close(): void {
    this.root.hidden = true;
    this.frame.src = "about:blank";
    document.body.classList.remove("has-viewer");
    this.restoreFocus?.focus();
  }

  private step(delta: number): void {
    if (this.list.length < 2) return;
    this.show((this.index + delta + this.list.length) % this.list.length);
  }

  private show(index: number): void {
    this.index = index;
    const photo = this.list[index];
    this.resetView();

    const isVideo = !!photo.video;
    this.frame.hidden = !isVideo;
    this.img.hidden = isVideo;
    this.root.classList.toggle("is-video", isVideo);
    if (isVideo) {
      this.frame.src = photo.video!;
      this.img.removeAttribute("src");
    } else {
      this.frame.src = "about:blank";
      // prima la miniatura (già in cache), poi la versione grande
      this.img.src = photo.thumb;
      this.img.alt = photo.title;
      if (photo.full && photo.full !== photo.thumb) {
        const big = new Image();
        big.onload = () => {
          if (this.list[this.index] === photo) this.img.src = photo.full;
        };
        big.src = photo.full;
      }
    }

    this.title.textContent = photo.title;
    this.meta.textContent = this.format(photo);
    this.desc.textContent = photo.description;
    this.link.href = photo.link;
    this.prev.hidden = this.next.hidden = this.list.length < 2;
  }

  private resetView(): void {
    this.scale = 1;
    this.x = this.y = 0;
    this.apply();
  }

  private apply(): void {
    this.img.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    this.stage.classList.toggle("is-zoomed", this.scale > 1.01);
  }

  /** Zoom attorno a un punto dello schermo (il centro, se non indicato). */
  private zoomAt(factor: number, cx?: number, cy?: number): void {
    const rect = this.stage.getBoundingClientRect();
    const px = (cx ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
    const py = (cy ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
    const next = Math.min(12, Math.max(1, this.scale * factor));
    const k = next / this.scale;
    this.x = px - (px - this.x) * k;
    this.y = py - (py - this.y) * k;
    this.scale = next;
    if (next === 1) this.x = this.y = 0;
    this.apply();
  }

  private pointerDown(e: PointerEvent): void {
    if (this.img.hidden) return;
    this.stage.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale };
    }
  }

  private pointerMove(e: PointerEvent): void {
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pinchStart && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const target = this.pinchStart.scale * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinchStart.distance);
      this.zoomAt(target / this.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (this.scale > 1) {
      this.x += e.clientX - last.x;
      this.y += e.clientY - last.y;
      this.apply();
    }
  }
}
