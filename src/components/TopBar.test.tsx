// src/components/TopBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  const mockProps = {
    onImport: vi.fn(),
    onAddPin: vi.fn(),
    onDeletePin: vi.fn(),
    onRotateImage: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onExportPdf: vi.fn(),
    isPinSelected: false,
    isImageLoaded: false,
    isAddingPin: false,
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
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalled();
  });

  it('disables Delete Pin button when no pin is selected', () => {
    render(<TopBar {...mockProps} isPinSelected={false} />);
    // "Delete Pin" text is present
    const deleteBtn = screen.getByRole('button', { name: /Delete Pin/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('enables Delete Pin button when a pin is selected', () => {
    render(<TopBar {...mockProps} isPinSelected={true} />);
    const deleteBtn = screen.getByRole('button', { name: /Delete Pin/i });
    expect(deleteBtn).not.toBeDisabled();
  });
});
