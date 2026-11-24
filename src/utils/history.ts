/**
 * Undo bookkeeping for continuous edits (typing in a field, dragging in a colour picker).
 * A session runs from focus (or pointerdown) to blur; only its first actual change records an
 * undo step, later changes update in place. Focusing a field and leaving it unchanged records
 * nothing, so no empty undo steps pile up.
 */
export interface EditSession {
  /** A new session begins. `alreadyRecorded`: the caller just recorded the undo step itself. */
  start: (alreadyRecorded?: boolean) => void;
  end: () => void;
  /** Call for each change; true for the first one of the session (= record history now). */
  next: () => boolean;
}

export const createEditSession = (): EditSession => {
  let recorded = false;
  return {
    start: (alreadyRecorded = false) => {
      recorded = alreadyRecorded;
    },
    end: () => {
      recorded = false;
    },
    next: () => {
      const first = !recorded;
      recorded = true;
      return first;
    },
  };
};

/** Structural equality for plain JSON-like data (pins, lines). */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  // A key set to undefined is the same as a missing key (spreads like { ...pin, textColor: undefined })
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const key of keys) if (!deepEqual(ra[key], rb[key])) return false;
  return true;
};
