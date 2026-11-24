import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAutosave,
  createDebouncer,
  formatRelativeTime,
  isProjectEmpty,
  loadAutosave,
  saveAutosave,
} from './autosave';
import { parseProject, serializeProject } from './project';
import type { ProjectState } from './project';
import type { PinData } from '../types';

const pin: PinData = {
  id: 'p1', x: 10, y: 20, targetX: 5, targetY: 6, text: 'PA0 · ADC0', color: '#ff0000', isPwm: false,
};

const baseState: ProjectState = {
  images: [], pins: [], lines: [], scale: 2, position: { x: 3, y: 4 }, gapSize: 12,
  legendItems: [{ id: 'l1', color: '#ff0000', text: 'Power' }], isLegendVisible: true, legendMode: 'all', legendShowCounts: false, anchorSize: 5, labelScale: null,
};

const withPin = (): ProjectState => ({ ...baseState, pins: [pin], labelScale: 0.5 });

beforeEach(async () => {
  await clearAutosave();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('autosave storage', () => {
  it('returns null when nothing was saved', async () => {
    expect(await loadAutosave()).toBeNull();
  });

  it('does not save an empty project', async () => {
    expect(isProjectEmpty(serializeProject(baseState))).toBe(true);
    expect(await saveAutosave(serializeProject(baseState))).toBe(false);
    expect(await loadAutosave()).toBeNull();
  });

  it('does not overwrite real work with an empty project', async () => {
    await saveAutosave(serializeProject(withPin()), 1);
    await saveAutosave(serializeProject(baseState), 2);
    expect((await loadAutosave())?.savedAt).toBe(1);
  });

  it('round-trips through parseProject', async () => {
    const state = withPin();
    expect(await saveAutosave(serializeProject(state), 12345)).toBe(true);

    const record = await loadAutosave();
    expect(record?.savedAt).toBe(12345);

    const parsed = parseProject(JSON.stringify(record!.project));
    expect(parsed.pins).toEqual(state.pins);
    expect(parsed.scale).toBe(2);
    expect(parsed.position).toEqual({ x: 3, y: 4 });
    expect(parsed.labelScale).toBe(0.5);
    expect(parsed.legendItems).toEqual(state.legendItems);
  });

  it('keeps only the latest snapshot', async () => {
    await saveAutosave(serializeProject(withPin()), 1);
    await saveAutosave(serializeProject({ ...withPin(), gapSize: 30 }), 2);
    const record = await loadAutosave();
    expect(record?.savedAt).toBe(2);
    expect(record?.project.gapSize).toBe(30);
  });

  it('clearAutosave removes the snapshot', async () => {
    await saveAutosave(serializeProject(withPin()));
    await clearAutosave();
    expect(await loadAutosave()).toBeNull();
  });

  it('ignores malformed stored records', async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pinout-maker', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('autosave');
      open.onsuccess = () => {
        const tx = open.result.transaction('autosave', 'readwrite');
        tx.objectStore('autosave').put({ nonsense: true }, 'current');
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
      open.onerror = () => reject(open.error);
    });
    expect(await loadAutosave()).toBeNull();
  });

  it('swallows storage errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('IndexedDB is unavailable');
      },
    });
    await expect(saveAutosave(serializeProject(withPin()))).resolves.toBe(false);
    await expect(loadAutosave()).resolves.toBeNull();
    await expect(clearAutosave()).resolves.toBeUndefined();
  });

  it('swallows asynchronous open failures', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request: { error: Error; onerror?: () => void } = { error: new Error('denied') };
        queueMicrotask(() => request.onerror?.());
        return request;
      },
    });
    await expect(saveAutosave(serializeProject(withPin()))).resolves.toBe(false);
    await expect(loadAutosave()).resolves.toBeNull();
  });
});

describe('createDebouncer', () => {
  it('coalesces rapid changes into one run of the latest task', () => {
    vi.useFakeTimers();
    const debouncer = createDebouncer(1000);
    const calls: number[] = [];

    for (let i = 1; i <= 5; i++) {
      debouncer.schedule(() => calls.push(i));
      vi.advanceTimersByTime(300);
    }
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1000);
    expect(calls).toEqual([5]);
  });

  it('cancel drops the pending task', () => {
    vi.useFakeTimers();
    const debouncer = createDebouncer(1000);
    const task = vi.fn();
    debouncer.schedule(task);
    debouncer.cancel();
    vi.advanceTimersByTime(5000);
    expect(task).not.toHaveBeenCalled();
  });

  it('flush runs the pending task immediately, once', () => {
    vi.useFakeTimers();
    const debouncer = createDebouncer(1000);
    const task = vi.fn();
    debouncer.schedule(task);
    debouncer.flush();
    debouncer.flush();
    vi.advanceTimersByTime(5000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('formatRelativeTime', () => {
  const now = 1_000_000_000;
  it.each([
    [10_000, 'just now'],
    [60_000, '1 minute ago'],
    [5 * 60_000, '5 minutes ago'],
    [2 * 3_600_000, '2 hours ago'],
    [3 * 86_400_000, '3 days ago'],
  ])('%i ms ago -> %s', (ago, expected) => {
    expect(formatRelativeTime(now - ago, now)).toBe(expected);
  });

  it('treats a timestamp in the future as just now', () => {
    expect(formatRelativeTime(now + 5000, now)).toBe('just now');
  });
});
