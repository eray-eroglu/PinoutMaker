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

export interface ProjectData {
  image: string; // Base64 or Path
  pins: PinData[];
  rotation: number;
  scale: number;
  position: { x: number; y: number };
  gapSize?: number;
}

declare global {
  interface Window {
    electronAPI?: {
      saveFile: (content: string) => Promise<{ success: boolean; path: string | null }>;
      saveFileDirect: (path: string, content: string) => Promise<{ success: boolean }>;
      loadFile: () => Promise<{ content: string | null; path: string | null }>;
      savePdf: (buffer: ArrayBuffer) => Promise<boolean>;
    };
  }
}
