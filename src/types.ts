export interface PinData {
  id: string;
  x: number; // Deprecated, kept for legacy migration
  y: number; // Deprecated, kept for legacy migration
  targetX: number;
  targetY: number;
  labelDx?: number; // Visual offset X (screen pixels)
  labelDy?: number; // Visual offset Y (screen pixels)
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
}

declare global {
  interface Window {
    electronAPI?: {
      saveFile: (content: string) => Promise<boolean>;
      loadFile: () => Promise<string | null>;
      savePdf: (buffer: ArrayBuffer) => Promise<boolean>;
    };
  }
}
