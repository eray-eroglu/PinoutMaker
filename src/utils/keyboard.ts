/** Input types the user types text into; keys pressed there belong to the field. */
const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

/**
 * True when the focused element takes typed text, so canvas shortcuts must leave the keys to it
 * (text undo, Backspace, arrows, copy/paste). Checkboxes, sliders, colour pickers and buttons
 * keep focus after a click but take no text: shortcuts still work there.
 */
export const isEditableElement = (el: Element | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  // `type` is 'text' for a missing or unknown type attribute
  return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type);
};

export type Overlay = 'help' | 'pinTable' | 'exportMenu' | 'library' | 'headerPanel';

export interface OpenOverlays {
  isHelpOpen: boolean;
  isPinTableOpen: boolean;
  isExportMenuOpen: boolean;
  isLibraryOpen: boolean;
  isHeaderPanelOpen: boolean;
}

/**
 * The top-most open panel or dialog, or null when none is open. While one is open, canvas
 * shortcuts are ignored and Escape closes only this one. Order: modal overlays first, then the
 * dropdown, then the side panels.
 */
export const topOverlay = (open: OpenOverlays): Overlay | null => {
  if (open.isHelpOpen) return 'help';
  if (open.isPinTableOpen) return 'pinTable';
  if (open.isExportMenuOpen) return 'exportMenu';
  if (open.isLibraryOpen) return 'library';
  if (open.isHeaderPanelOpen) return 'headerPanel';
  return null;
};
