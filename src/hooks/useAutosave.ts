import { useEffect, useRef } from 'react';
import { AUTOSAVE_DEBOUNCE_MS, clearAutosave, createDebouncer, isProjectEmpty, saveAutosave } from '../utils/autosave';
import { serializeProject } from '../utils/project';
import type { ProjectState } from '../utils/project';

/**
 * Mirrors the project to IndexedDB ~1 s after the last meaningful change.
 * `enabled` must be false while a recovered snapshot is pending, a project is still loading
 * or the startup check has not finished, so those states can never overwrite real work.
 * Pan/zoom (scale, position) alone does not trigger a save, but is stored with the next one.
 * An empty project is never stored: when the user empties a project that had content, the
 * snapshot is deleted instead, so a reload does not offer the deleted work. The empty canvas at
 * startup leaves the storage alone.
 */
export const useAutosave = (state: ProjectState, enabled: boolean) => {
  const { images, pins, lines, gapSize, legendItems, isLegendVisible, legendMode, legendShowCounts, anchorSize, labelScale } = state;

  // Read at save time so the snapshot has the latest pan/zoom without re-triggering on it.
  const latestRef = useRef(state);
  useEffect(() => {
    latestRef.current = state;
  });

  const debouncerRef = useRef(createDebouncer(AUTOSAVE_DEBOUNCE_MS));
  // Whether this session has stored (or is about to store) a non-empty snapshot
  const hasSavedContentRef = useRef(false);

  useEffect(() => {
    const debouncer = debouncerRef.current;
    if (!enabled) return;
    debouncer.schedule(() => {
      const project = serializeProject(latestRef.current);
      if (!isProjectEmpty(project)) {
        hasSavedContentRef.current = true;
        void saveAutosave(project);
      } else if (hasSavedContentRef.current) {
        hasSavedContentRef.current = false;
        void clearAutosave();
      }
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
