import { describe, it, expect } from 'vitest';
import { isEditableElement, topOverlay } from './keyboard';
import type { OpenOverlays } from './keyboard';

const input = (type?: string) => {
  const el = document.createElement('input');
  if (type !== undefined) el.setAttribute('type', type);
  return el;
};

describe('isEditableElement', () => {
  it.each([undefined, 'text', 'number', 'search', 'email', 'url', 'tel', 'password'])('input type=%s takes text', type => {
    expect(isEditableElement(input(type))).toBe(true);
  });

  it.each(['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'file'])('input type=%s does not', type => {
    expect(isEditableElement(input(type))).toBe(false);
  });

  it('treats textarea and select as editable, buttons and null as not', () => {
    expect(isEditableElement(document.createElement('textarea'))).toBe(true);
    expect(isEditableElement(document.createElement('select'))).toBe(true);
    expect(isEditableElement(document.createElement('button'))).toBe(false);
    expect(isEditableElement(document.body)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});

describe('topOverlay', () => {
  const none: OpenOverlays = {
    isHelpOpen: false, isPinTableOpen: false, isExportMenuOpen: false, isLibraryOpen: false, isHeaderPanelOpen: false,
  };

  it('is null when nothing is open', () => {
    expect(topOverlay(none)).toBeNull();
  });

  it('picks the top-most of several open panels', () => {
    expect(topOverlay({ ...none, isLibraryOpen: true, isHeaderPanelOpen: true })).toBe('library');
    expect(topOverlay({ ...none, isLibraryOpen: true, isExportMenuOpen: true })).toBe('exportMenu');
    expect(topOverlay({ ...none, isPinTableOpen: true, isLibraryOpen: true })).toBe('pinTable');
    expect(topOverlay({ ...none, isHelpOpen: true, isPinTableOpen: true })).toBe('help');
    expect(topOverlay({ ...none, isHeaderPanelOpen: true })).toBe('headerPanel');
  });
});
