import type { Kind } from "../data/objects";

/** Colore di ogni tipo di oggetto: marker sulla mappa e filtri. */
export const KIND_COLOR: Record<Kind, string> = {
  nebula: "#ff8ad4",
  galaxy: "#9db8ff",
  cluster: "#ffe28a",
  remnant: "#ff9f6e",
  blackhole: "#c9a0ff",
  planet: "#ffd27a",
  moon: "#e8ecf5",
  sun: "#ffbf4d",
};
