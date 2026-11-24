import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { createEditSession } from '../utils/history';
import type { EditSession } from '../utils/history';

/** A stable edit session for a component (see createEditSession). */
export const useEditSession = (): EditSession => useState(createEditSession)[0];

/**
 * Props for an `<input type="color">`: one undo step per picker session. The session starts
 * when the picker is opened (pointerdown / focus); while the user drags through colours every
 * `input` event applies live, and only the first one records history.
 */
export const colorPickerSession = (session: EditSession, onPick: (color: string, saveHistory: boolean) => void) => ({
  onPointerDown: () => session.start(),
  onFocus: () => session.start(),
  onBlur: () => session.end(),
  onChange: (e: ChangeEvent<HTMLInputElement>) => onPick(e.target.value, session.next()),
});
