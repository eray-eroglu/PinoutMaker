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
  isPwm: boolean;
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
  scale: number;
  position: { x: number; y: number };
  gapSize?: number;
  legendItems?: LegendItem[];
  isLegendVisible?: boolean;
}

