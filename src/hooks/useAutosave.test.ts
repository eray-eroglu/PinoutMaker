import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';
import type { ProjectState } from '../utils/project';
import type { PinData } from '../types';

const { saveAutosave, clearAutosave } = vi.hoisted(() => ({
  saveAutosave: vi.fn(async () => true),
  clearAutosave: vi.fn(async () => {}),
}));
vi.mock('../utils/autosave', async importOriginal => ({
  ...(await importOriginal<typeof import('../utils/autosave')>()),
  saveAutosave,
  clearAutosave,
}));

const pin = (id: string): PinData => ({ id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000', isPwm: false });

// Stable references, like React state: a new array would count as a change.
const stable = { images: [], pins: [pin('a')], lines: [], legendItems: [] };
const state = (overrides: Partial<ProjectState> = {}): ProjectState => ({
  ...stable, scale: 1, position: { x: 0, y: 0 }, gapSize: 12, isLegendVisible: true, legendMode: 'all', legendShowCounts: false, anchorSize: 5, labelScale: 1,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  saveAutosave.mockClear();
  clearAutosave.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('saves once, 1 s after the last of several rapid changes', () => {
    const { rerender } = renderHook(({ s, enabled }) => useAutosave(s, enabled), {
      initialProps: { s: state(), enabled: true },
    });
    for (const id of ['b', 'c', 'd']) {
      vi.advanceTimersByTime(400);
      rerender({ s: state({ pins: [pin(id)] }), enabled: true });
    }
    expect(saveAutosave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(saveAutosave).toHaveBeenCalledTimes(1);
    const saved = (saveAutosave.mock.calls[0] as unknown[])[0] as { pins: PinData[] };
    expect(saved.pins.map(p => p.id)).toEqual(['d']);
  });

  it('does not save while disabled (pending restore, loading)', () => {
    const { rerender } = renderHook(({ s, enabled }) => useAutosave(s, enabled), {
      initialProps: { s: state(), enabled: false },
    });
    rerender({ s: state({ pins: [pin('b')] }), enabled: false });
    vi.advanceTimersByTime(5000);
    expect(saveAutosave).not.toHaveBeenCalled();
  });

  it('drops a pending save when disabled, and resumes when re-enabled', () => {
    const { rerender } = renderHook(({ s, enabled }) => useAutosave(s, enabled), {
      initialProps: { s: state(), enabled: true },
    });
    rerender({ s: state(), enabled: false });
    vi.advanceTimersByTime(5000);
    expect(saveAutosave).not.toHaveBeenCalled();

    rerender({ s: state(), enabled: true });
    vi.advanceTimersByTime(1000);
    expect(saveAutosave).toHaveBeenCalledTimes(1);
  });

  it('does not save for pan/zoom alone, but includes it in the next save', () => {
    const { rerender } = renderHook(({ s }) => useAutosave(s, true), { initialProps: { s: state() } });
    vi.advanceTimersByTime(1000);
    saveAutosave.mockClear();

    rerender({ s: state({ scale: 3, position: { x: 9, y: 9 } }) });
    vi.advanceTimersByTime(5000);
    expect(saveAutosave).not.toHaveBeenCalled();

    rerender({ s: state({ scale: 3, position: { x: 9, y: 9 }, gapSize: 20 }) });
    vi.advanceTimersByTime(1000);
    const saved = (saveAutosave.mock.calls[0] as unknown[])[0] as { scale: number; gapSize: number };
    expect(saved).toMatchObject({ scale: 3, gapSize: 20 });
  });

  it('flushes immediately when the tab is hidden', () => {
    renderHook(() => useAutosave(state(), true));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(saveAutosave).toHaveBeenCalledTimes(1);
  });

  it('leaves the storage alone for the empty canvas at startup', () => {
    const empty = state({ pins: [] });
    const { rerender } = renderHook(({ s }) => useAutosave(s, true), { initialProps: { s: empty } });
    rerender({ s: { ...empty, gapSize: 20 } });
    vi.advanceTimersByTime(5000);
    expect(saveAutosave).not.toHaveBeenCalled();
    expect(clearAutosave).not.toHaveBeenCalled();
  });

  it('clears the snapshot when the user empties a project that had content', () => {
    const { rerender } = renderHook(({ s }) => useAutosave(s, true), { initialProps: { s: state() } });
    vi.advanceTimersByTime(1000);
    expect(saveAutosave).toHaveBeenCalledTimes(1);

    const emptied = state({ pins: [] });
    rerender({ s: emptied });
    vi.advanceTimersByTime(1000);
    expect(clearAutosave).toHaveBeenCalledTimes(1);
    expect(saveAutosave).toHaveBeenCalledTimes(1);

    // Staying empty does not clear again
    rerender({ s: { ...emptied, gapSize: 30 } });
    vi.advanceTimersByTime(1000);
    expect(clearAutosave).toHaveBeenCalledTimes(1);
  });
});
