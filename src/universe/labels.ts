/**
 * Etichette HTML sopra la scena 3D. A ogni fotogramma riceve le etichette candidate
 * (già proiettate in pixel e ordinate per importanza) e mostra solo quelle che non si sovrappongono.
 */

export interface LabelCandidate {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  /** Etichetta di una regione (fascia, galassia…): stile diverso, nessun punto. */
  region: boolean;
  focused: boolean;
}

interface LabelNode {
  el: HTMLButtonElement;
  shown: boolean;
  x: number;
  y: number;
  focused: boolean;
}

const CELL = 24;

export class LabelLayer {
  private readonly nodes = new Map<string, LabelNode>();
  readonly root: HTMLDivElement;

  constructor(host: HTMLElement, private readonly onPick: (id: string) => void) {
    this.root = document.createElement("div");
    this.root.className = "u-labels";
    host.append(this.root);
  }

  private node(candidate: LabelCandidate): LabelNode {
    let node = this.nodes.get(candidate.id);
    if (!node) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = candidate.region ? "u-label u-label--region" : "u-label";
      el.textContent = candidate.name;
      el.style.setProperty("--dot", candidate.color);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onPick(candidate.id);
      });
      // il trascinamento parte dalla scena anche se il puntatore è sopra un'etichetta
      el.addEventListener("pointerdown", (event) => event.stopPropagation());
      this.root.append(el);
      node = { el, shown: false, x: NaN, y: NaN, focused: false };
      this.nodes.set(candidate.id, node);
    }
    return node;
  }

  /** Mostra le etichette nell'ordine dato, saltando quelle che si sovrappongono alle precedenti. */
  update(candidates: LabelCandidate[], width: number, height: number): void {
    const taken = new Set<number>();
    const visible = new Set<string>();
    const cols = Math.ceil(width / CELL) + 1;

    for (const candidate of candidates) {
      if (candidate.x < -40 || candidate.x > width + 40 || candidate.y < -20 || candidate.y > height + 20) continue;
      const w = 18 + candidate.name.length * 6.6;
      const x0 = Math.floor((candidate.x - (candidate.region ? w / 2 : 4)) / CELL);
      const x1 = Math.floor((candidate.x + (candidate.region ? w / 2 : w)) / CELL);
      const y0 = Math.floor((candidate.y - 10) / CELL);
      const y1 = Math.floor((candidate.y + 10) / CELL);
      let free = true;
      const cells: number[] = [];
      for (let gy = y0; gy <= y1 && free; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const key = (gy + 2) * cols + gx + 2;
          if (taken.has(key)) {
            free = false;
            break;
          }
          cells.push(key);
        }
      }
      if (!free && !candidate.focused) continue;
      for (const key of cells) taken.add(key);
      visible.add(candidate.id);

      const node = this.node(candidate);
      const x = Math.round(candidate.x);
      const y = Math.round(candidate.y);
      if (x !== node.x || y !== node.y) {
        node.el.style.transform = `translate(${x}px, ${y}px)`;
        node.x = x;
        node.y = y;
      }
      if (!node.shown) {
        node.el.classList.add("is-shown");
        node.shown = true;
      }
      if (node.focused !== candidate.focused) {
        node.el.classList.toggle("is-focused", candidate.focused);
        node.focused = candidate.focused;
      }
    }

    for (const [id, node] of this.nodes) {
      if (node.shown && !visible.has(id)) {
        node.el.classList.remove("is-shown");
        node.shown = false;
      }
    }
  }

  clear(): void {
    for (const node of this.nodes.values()) {
      node.el.classList.remove("is-shown");
      node.shown = false;
    }
  }
}
