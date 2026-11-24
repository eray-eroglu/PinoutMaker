/** An extra function label shown in the pin's label row (e.g. ADC0, SDA1). */
export interface PinFunction {
  id: string;
  text: string;
  color: string;
  textColor?: string;
}

export interface PinData {
  id: string;
  /** World position (board-image pixels) of the primary label's top-left corner. */
  x: number;
  y: number;
  /** World position of the anchor dot. */
  targetX: number;
  targetY: number;
  /** @deprecated Screen-pixel label offset used by older files; converted to x/y on load. */
  labelDx?: number;
  /** @deprecated See labelDx. */
  labelDy?: number;
  /**
   * @deprecated Measured label size written by older versions. Label geometry now comes from
   * layoutPinLabels (utils/pinLayout.ts); the fields are ignored and only kept so old files type-check.
   */
  labelWidth?: number;
  /** @deprecated See labelWidth. */
  labelHeight?: number;
  /** Primary label, joined to the anchor by the leader line. */
  text: string;
  color: string;
  textColor?: string;
  isPwm: boolean;
  /**
   * Extra labels, in the order they follow the primary one (continuing away from the anchor).
   * They have no stored position; layoutPinLabels derives it. Missing in older files.
   */
  functions?: PinFunction[];
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

/** Which legend rows are drawn: all, only colours in use, or all with unused ones dimmed. */
export type LegendMode = 'all' | 'used' | 'dimUnused';

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
  legendMode?: LegendMode;
  legendShowCounts?: boolean;
  anchorSize?: number;
  /**
   * World size of one label unit. Labels, anchors, leader lines and drawn lines are
   * multiplied by it, so they zoom together with the board. Missing in older files.
   */
  labelScale?: number;
}

