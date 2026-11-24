import { useEffect, useRef } from 'react';
import { AUTOSAVE_DEBOUNCE_MS, createDebouncer, saveAutosave } from '../utils/autosave';
import { serializeProject } from '../utils/project';
import type { ProjectState } from '../utils/project';

/**
 * Mirrors the project to IndexedDB ~1 s after the last meaningful change.
 * `enabled` must be false while a recovered snapshot is pending, a project is still loading
 * or the startup check has not finished, so those states can never overwrite real work.
 * Pan/zoom (scale, position) alone does not trigger a save, but is stored with the next one.
 */
export const useAutosave = (state: ProjectState, enabled: boolean) => {
  const { images, pins, lines, gapSize, legendItems, isLegendVisible, legendMode, legendShowCounts, anchorSize, labelScale } = state;

  // Read at save time so the snapshot has the latest pan/zoom without re-triggering on it.
  const latestRef = useRef(state);
  useEffect(() => {
    latestRef.current = state;
  });

  const debouncerRef = useRef(createDebouncer(AUTOSAVE_DEBOUNCE_MS));

  useEffect(() => {
    const debouncer = debouncerRef.current;
    if (!enabled) return;
    debouncer.schedule(() => {
      void saveAutosave(serializeProject(latestRef.current));
    });
    // Leaving the page within the debounce window would lose the last edit: write it out now.
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') debouncer.flush();
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      debouncer.cancel();
    };
  }, [enabled, images, pins, lines, gapSize, legendItems, isLegendVisible, legendMode, legendShowCounts, anchorSize, labelScale]);
};
