/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// File System Access API (Chromium only; not yet in TypeScript's DOM lib)
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface Window {
  showSaveFilePicker?: (options?: { suggestedName?: string; types?: FilePickerAcceptType[] }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: { types?: FilePickerAcceptType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
}
