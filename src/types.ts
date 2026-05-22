export interface PinData {
  id: string;
  x: number; // Deprecated, kept for legacy migration
  y: number; // Deprecated, kept for legacy migration
  targetX: number;
  targetY: number;
  labelDx?: number; // Visual offset X (screen pixels)
  labelDy?: number; // Visual offset Y (screen pixels)
  labelWidth?: number; // Width of the label in world coordinates
  labelHeight?: number; // Height of the label in world coordinates
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
}

