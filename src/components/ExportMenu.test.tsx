import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  it('opens a dropdown and exports the picked format with the options', () => {
    const onExport = vi.fn();
    render(<ExportMenu onExport={onExport} isLegendVisible={true} />);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(screen.getByLabelText('Include legend')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '×4' }));
    fireEvent.click(screen.getByLabelText('Transparent PNG background'));
    fireEvent.click(screen.getByRole('menuitem', { name: /PNG/ }));

    expect(onExport).toHaveBeenCalledWith({ format: 'png', includeLegend: true, pngScale: 4, transparent: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('reports open/close and keeps Escape from reaching the canvas shortcuts', () => {
    const onOpenChange = vi.fn();
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    render(<ExportMenu onExport={vi.fn()} isLegendVisible={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onWindowKey);
  });

  it('defaults "Include legend" to the canvas legend visibility', () => {
    const onExport = vi.fn();
    render(<ExportMenu onExport={onExport} isLegendVisible={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(screen.getByLabelText('Include legend')).not.toBeChecked();
    fireEvent.click(screen.getByRole('menuitem', { name: /SVG/ }));
    expect(onExport).toHaveBeenCalledWith({ format: 'svg', includeLegend: false, pngScale: 2, transparent: false });
  });
});
