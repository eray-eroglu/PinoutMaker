import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColorPalette, Sidebar } from './Sidebar';
import type { PinData } from '../types';

const pin: PinData = {
  id: 'p', x: 0, y: 0, targetX: 0, targetY: 0, text: 'PA0', color: '#dc2626', isPwm: false,
  functions: [{ id: 'f', text: 'ADC0', color: '#16a34a' }],
};

const sidebarProps = (over: Partial<ComponentProps<typeof Sidebar>> = {}): ComponentProps<typeof Sidebar> => ({
  selectedPin: pin, selectedFunctionIndex: -1, onSelectFunctionIndex: vi.fn(), onUpdatePin: vi.fn(),
  selectedImage: null, onUpdateImage: vi.fn(), selectedLine: null, onUpdateLine: vi.fn(),
  onExportPinoutTemplate: vi.fn(), gapSize: 12, onGapSizeChange: vi.fn(), legendItems: [], onLegendItemsChange: vi.fn(),
  isLegendVisible: true, onLegendVisibilityChange: vi.fn(), legendMode: 'all', onLegendModeChange: vi.fn(),
  legendShowCounts: false, onLegendShowCountsChange: vi.fn(), anchorSize: 5, onAnchorSizeChange: vi.fn(),
  labelScale: 1, onLabelScaleChange: vi.fn(),
  ...over,
});

/** The saveHistory flag of every onUpdatePin call. */
const historyFlags = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(call => call[1]);

describe('ColorPalette', () => {
  it('records one undo step per picker session, however many colours are dragged through', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPalette value='#dc2626' onChange={onChange} />);
    const picker = container.querySelector('input[type=color]')!;

    fireEvent.pointerDown(picker);
    fireEvent.focus(picker);
    for (const c of ['#111111', '#222222', '#333333']) fireEvent.input(picker, { target: { value: c } });
    expect(onChange.mock.calls).toEqual([['#111111', true], ['#222222', false], ['#333333', false]]);

    // Opening the picker again is a new step
    fireEvent.pointerDown(picker);
    fireEvent.input(picker, { target: { value: '#444444' } });
    expect(onChange).toHaveBeenLastCalledWith('#444444', true);
  });

  it('records each swatch click', () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPalette value={null} onChange={onChange} />);
    fireEvent.click(container.querySelector('.grid > div')!);
    expect(onChange).toHaveBeenCalledWith('#dc2626', true);
  });
});

describe('Sidebar edit sessions', () => {
  it('focusing the pin name and leaving it unchanged records nothing', () => {
    const onUpdatePin = vi.fn();
    render(<Sidebar {...sidebarProps({ onUpdatePin })} />);
    const name = screen.getByDisplayValue('PA0');
    fireEvent.focus(name);
    fireEvent.blur(name);
    expect(onUpdatePin).not.toHaveBeenCalled();
  });

  it('typing into the pin name records history on the first change only', () => {
    const onUpdatePin = vi.fn();
    render(<Sidebar {...sidebarProps({ onUpdatePin })} />);
    const name = screen.getByDisplayValue('PA0');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'PA01' } });
    fireEvent.change(name, { target: { value: 'PA012' } });
    expect(historyFlags(onUpdatePin)).toEqual([true, false]);
    // A new focus is a new undo step
    fireEvent.blur(name);
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'PA1' } });
    expect(historyFlags(onUpdatePin)).toEqual([true, false, true]);
  });

  it('function inputs work the same way', () => {
    const onUpdatePin = vi.fn();
    render(<Sidebar {...sidebarProps({ onUpdatePin })} />);
    const fn = screen.getByDisplayValue('ADC0');
    fireEvent.focus(fn);
    fireEvent.blur(fn);
    expect(onUpdatePin).not.toHaveBeenCalled();
    fireEvent.focus(fn);
    fireEvent.change(fn, { target: { value: 'ADC01' } });
    fireEvent.change(fn, { target: { value: 'ADC012' } });
    expect(historyFlags(onUpdatePin)).toEqual([true, false]);
  });
});
