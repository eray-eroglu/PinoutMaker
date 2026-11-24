export interface PinData {
  id: string;
  /** World position (board-image pixels) of the label's top-left corner. */
  x: number;
  y: number;
  /** World position of the anchor dot. */
  targetX: number;
  targetY: number;
  /** @deprecated Screen-pixel label offset used by older files; converted to x/y on load. */
  labelDx?: number;
  /** @deprecated See labelDx. */
  labelDy?: number;
  /** Measured label size in label units (multiply by the project's labelScale for world size). */
  labelWidth?: number;
  labelHeight?: number;
  text: string;
  color: string;
  textColor?: string;
  isPwm: boolean;
}

export interface LineData {
  id: string;
  /** Multi-point polyline [x0,y0, x1,y1, ...]. All segments are orthogonal (Manhattan). */
  points: number[];
  /** Legacy fields kept for backward compatibility when loading old projects */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  isAngled?: boolean;
  color: string;
  thickness: number;
}

export interface LegendItem {
  id: string;
  text: string;
  color: string;
}

export interface BoardImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ProjectData {
  image?: string; // Base64 or Path (legacy support)
  rotation?: number; // (legacy support)
  images?: BoardImage[];
  pins: PinData[];
  lines?: LineData[];
  scale: number;
  position: { x: number; y: number };
  gapSize?: number;
  legendItems?: LegendItem[];
  isLegendVisible?: boolean;
  anchorSize?: number;
  /**
   * World size of one label unit. Labels, anchors, leader lines and drawn lines are
   * multiplied by it, so they zoom together with the board. Missing in older files.
   */
  labelScale?: number;
}

