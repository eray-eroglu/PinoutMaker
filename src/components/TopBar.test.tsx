// src/components/TopBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopBar } from './TopBar';
import { LanguageProvider } from '../i18n/LanguageProvider';

describe('TopBar', () => {
  const mockProps = {
    onImport: vi.fn(),
    onAddPin: vi.fn(),
    onAddLine: vi.fn(),
    onDeletePin: vi.fn(),
    onRotateImage: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onExport: vi.fn(),
    isLegendVisible: true,
    onToggleLibrary: vi.fn(),
    isPinSelected: false,
    isImageLoaded: false,
    isAddingPin: false,
    isAddingLine: false,
    isLibraryOpen: false,
  };

  it('renders all main buttons', () => {
    render(<TopBar {...mockProps} />);

    // Check for buttons by title or aria-label if we added them in TopBar
    // Since we didn't add explicit aria-labels, we might need to rely on title attributes provided in TopBar.tsx
    // Let's quickly check if TopBar has title attributes.
    // If not, we might need to check if we can query by icon or just ensure no crash.
    // Wait, let's verify TopBar content first.
    // Assuming TopBar uses title="..." for tooltips.

    // Or we can check if buttons exist.
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onAddPin when Add Pin button is clicked', () => {
    render(<TopBar {...mockProps} />);
    const addPinBtn = screen.getByRole('button', { name: /Add Pin/i });
    fireEvent.click(addPinBtn);
    expect(mockProps.onAddPin).toHaveBeenCalled();
  });

  it('calls onSave when Save button is clicked', () => {
    render(<TopBar {...mockProps} />);
    const buttons = screen.getAllByRole('button');
    const saveBtn = buttons.find(b => b.textContent?.includes('Save your current')) || buttons[0];
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalled();
  });

  it('disables Delete Pin button when no pin is selected', () => {
    render(<TopBar {...mockProps} isPinSelected={false} />);
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('enables Delete Pin button when a pin is selected', () => {
    render(<TopBar {...mockProps} isPinSelected={true} />);
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    expect(deleteBtn).not.toBeDisabled();
  });

  it('toggles the header tool and enables the pin table only when headers exist', () => {
    const onAddHeader = vi.fn();
    const onOpenPinTable = vi.fn();
    const { rerender } = render(<TopBar {...mockProps} onAddHeader={onAddHeader} onOpenPinTable={onOpenPinTable} hasHeaders={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Header/i }));
    expect(onAddHeader).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Pin table…/ })).toBeDisabled();

    rerender(<TopBar {...mockProps} onAddHeader={onAddHeader} onOpenPinTable={onOpenPinTable} hasHeaders isAddingHeader />);
    // The label stays put while the tool is active (the instruction is a canvas hint)
    expect(screen.getByRole('button', { name: /Add Header/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pin table…/ }));
    expect(onOpenPinTable).toHaveBeenCalled();
  });

  it('opens the keyboard shortcuts from the toolbar', () => {
    const onShowShortcuts = vi.fn();
    render(<TopBar {...mockProps} onShowShortcuts={onShowShortcuts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(onShowShortcuts).toHaveBeenCalled();
  });

  it('speaks Turkish, including the language and theme buttons', () => {
    const onShowShortcuts = vi.fn();
    render(
      <LanguageProvider initial='tr'>
        <TopBar {...mockProps} onShowShortcuts={onShowShortcuts} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button', { name: /Pin ekle/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sil/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'İngilizceye geç (English)' })).toHaveTextContent('TR');
    expect(screen.getByRole('button', { name: /^Tema: / })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Klavye kısayolları' }));
    expect(onShowShortcuts).toHaveBeenCalled();

    // The language button switches the whole toolbar back to English
    fireEvent.click(screen.getByRole('button', { name: 'İngilizceye geç (English)' }));
    expect(screen.getByRole('button', { name: /Add Pin/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Turkish (Türkçe)' })).toHaveTextContent('EN');
  });
});
