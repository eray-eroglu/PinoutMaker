import type { ProjectData } from '../types';
import type { Language } from '../i18n';

/**
 * Crash/refresh protection: the current project is mirrored to IndexedDB. localStorage is not an
 * option because projects embed images as data URLs and blow through its ~5 MB quota.
 * Every storage access fails silently (private mode, quota, blocked): the editor must work without it.
 */

export interface AutosaveRecord {
  savedAt: number;
  /** Exactly the saved-file format, so it can be restored through parseProject. */
  project: ProjectData;
}

export const AUTOSAVE_DEBOUNCE_MS = 1000;

const DB_NAME = 'pinout-maker';
const STORE_NAME = 'autosave';
const RECORD_KEY = 'current';
/**
 * The snapshot found at startup, moved aside so `current` can keep mirroring the new session
 * while the user decides whether to restore it.
 */
const RECOVERED_KEY = 'recovered';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

/** Runs one request in its own transaction and resolves once the transaction has committed. */
const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
};

const isRecord = (value: unknown): value is AutosaveRecord => {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<AutosaveRecord>;
  return typeof r.savedAt === 'number' && !!r.project && typeof r.project === 'object';
};

/** An empty canvas is not worth saving (and must never overwrite real work). */
export const isProjectEmpty = (project: ProjectData): boolean =>
  (project.images?.length ?? 0) === 0 && (project.pins?.length ?? 0) === 0 && (project.lines?.length ?? 0) === 0;

/** Returns true if the snapshot was stored. */
export const saveAutosave = async (project: ProjectData, now: number = Date.now()): Promise<boolean> => {
  if (isProjectEmpty(project)) return false;
  try {
    const record: AutosaveRecord = { savedAt: now, project };
    await withStore('readwrite', store => store.put(record, RECORD_KEY));
    return true;
  } catch (error) {
    console.warn('Autosave failed:', error);
    return false;
  }
};

const loadRecord = async (key: string): Promise<AutosaveRecord | null> => {
  try {
    const value: unknown = await withStore('readonly', store => store.get(key));
    return isRecord(value) ? value : null;
  } catch (error) {
    console.warn('Reading autosave failed:', error);
    return null;
  }
};

const deleteRecord = async (key: string): Promise<void> => {
  try {
    await withStore('readwrite', store => store.delete(key));
  } catch (error) {
    console.warn('Clearing autosave failed:', error);
  }
};

/** The snapshot of the running session. */
export const loadAutosave = () => loadRecord(RECORD_KEY);
export const clearAutosave = () => deleteRecord(RECORD_KEY);

/** The snapshot offered for restoring (see takeAutosaveForRecovery). */
export const loadRecoveredAutosave = () => loadRecord(RECOVERED_KEY);
export const clearRecoveredAutosave = () => deleteRecord(RECOVERED_KEY);

/**
 * Startup: moves the previous session's snapshot to the `recovered` slot (in one transaction)
 * and returns it, so autosave can write the new session from the start without ever
 * overwriting it. With no previous snapshot, a recovered one still waiting from an earlier
 * start (the user reloaded without choosing) is returned instead.
 */
export const takeAutosaveForRecovery = async (): Promise<AutosaveRecord | null> => {
  try {
    const db = await openDb();
    try {
      return await new Promise<AutosaveRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        let result: AutosaveRecord | null = null;
        const current = store.get(RECORD_KEY);
        current.onsuccess = () => {
          if (isRecord(current.result)) {
            result = current.result;
            store.put(current.result, RECOVERED_KEY);
            store.delete(RECORD_KEY);
            return;
          }
          const recovered = store.get(RECOVERED_KEY);
          recovered.onsuccess = () => {
            result = isRecord(recovered.result) ? recovered.result : null;
          };
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('Reading autosave failed:', error);
    return null;
  }
};

export interface Debouncer {
  /** (Re)starts the timer; only the latest scheduled task runs. */
  schedule: (task: () => void) => void;
  /** Runs the pending task now, if any (e.g. when the tab is being hidden). */
  flush: () => void;
  cancel: () => void;
}

export const createDebouncer = (delayMs: number): Debouncer => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  const flush = () => {
    const task = pending;
    cancel();
    task?.();
  };

  const schedule = (task: () => void) => {
    if (timer !== null) clearTimeout(timer);
    pending = task;
    timer = setTimeout(flush, delayMs);
  };

  return { schedule, flush, cancel };
};

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago" (Turkish: "az önce", "5 dakika önce", …). */
export const formatRelativeTime = (savedAt: number, now: number = Date.now(), language: Language = 'en'): string => {
  const seconds = Math.max(0, (now - savedAt) / 1000);
  if (seconds < 45) return language === 'tr' ? 'az önce' : 'just now';
  const minutes = seconds / 60;
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    minutes < 60 ? [minutes, 'minute'] : minutes < 60 * 24 ? [minutes / 60, 'hour'] : [minutes / 60 / 24, 'day'];
  return new Intl.RelativeTimeFormat(language, { numeric: 'always' }).format(-Math.max(1, Math.round(value)), unit);
};
