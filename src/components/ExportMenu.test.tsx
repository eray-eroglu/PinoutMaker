import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExportMenu } from './ExportMenu';
import { LanguageProvider } from '../i18n/LanguageProvider';

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

  it('speaks Turkish', () => {
    const onExport = vi.fn();
    render(
      <LanguageProvider initial='tr'>
        <ExportMenu onExport={onExport} isLegendVisible={true} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dışa aktar/ }));
    expect(screen.getByLabelText('Lejantı dahil et')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Saydam PNG arka planı'));
    expect(screen.getByRole('menuitem', { name: /Yüksek çözünürlüklü görsel/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF/ }));
    expect(onExport).toHaveBeenCalledWith({ format: 'pdf', includeLegend: true, pngScale: 2, transparent: true });
  });
  it('keeps its name when only the icon shows, and floats the menu under the button', () => {
    render(<ExportMenu onExport={vi.fn()} isLegendVisible={true} labelClassName='hidden lg:inline' />);
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button.querySelector('.hidden')).toHaveTextContent('Export');

    button.getBoundingClientRect = () => ({ left: 300, right: 360, top: 10, bottom: 44, width: 60, height: 34, x: 300, y: 10, toJSON: () => ({}) });
    fireEvent.click(button);
    // Fixed, so a scrolling toolbar can't clip it
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('fixed');
    expect(menu.style.top).toBe('48px');
    expect(menu.style.left).toBe('8px'); // jsdom's window is 0px wide, so the menu is kept at the margin

    // Scrolling would leave it behind its button, so it closes
    fireEvent.scroll(window);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  describe('pin list entry', () => {
    it('is hidden without onExportPinList', () => {
      render(<ExportMenu onExport={vi.fn()} isLegendVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: /Export/ }));
      expect(screen.queryByRole('menuitem', { name: /Pin list/ })).toBeNull();
    });

    it('calls onExportPinList and closes the menu', () => {
      const onExport = vi.fn();
      const onExportPinList = vi.fn();
      const onOpenChange = vi.fn();
      render(<ExportMenu onExport={onExport} isLegendVisible={true} onExportPinList={onExportPinList} hasPins={true} onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByRole('button', { name: /Export/ }));
      const item = screen.getByRole('menuitem', { name: /Pin list \(CSV\)/ });
      expect(item).toHaveTextContent('All pins and functions, for Excel');
      expect(item).toBeEnabled();
      fireEvent.click(item);
      expect(onExportPinList).toHaveBeenCalledTimes(1);
      expect(onExport).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBeNull();
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('is disabled with a tooltip when there are no pins', () => {
      const onExportPinList = vi.fn();
      render(<ExportMenu onExport={vi.fn()} isLegendVisible={true} onExportPinList={onExportPinList} hasPins={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Export/ }));
      const item = screen.getByRole('menuitem', { name: /Pin list/ });
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute('title', 'Add pins first: the project has none to list');
      fireEvent.click(item);
      expect(onExportPinList).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('speaks Turkish', () => {
      const onExportPinList = vi.fn();
      render(
        <LanguageProvider initial='tr'>
          <ExportMenu onExport={vi.fn()} isLegendVisible={true} onExportPinList={onExportPinList} />
        </LanguageProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Dışa aktar/ }));
      const item = screen.getByRole('menuitem', { name: /Pin listesi \(CSV\)/ });
      expect(item).toHaveTextContent('Tüm pinler ve fonksiyonlar, Excel için');
      fireEvent.click(item);
      expect(onExportPinList).toHaveBeenCalledTimes(1);
    });
  });
});
