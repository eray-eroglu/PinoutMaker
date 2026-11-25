import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { MultiPinPanel } from './MultiPinPanel';
import { LanguageProvider } from '../i18n/LanguageProvider';
import type { PinData } from '../types';

const pin = (id: string): PinData => ({ id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000000', isPwm: false });

const props = (overrides: Partial<ComponentProps<typeof MultiPinPanel>> = {}): ComponentProps<typeof MultiPinPanel> => ({
  pins: [pin('a'), pin('b')],
  rowPitch: null,
  combinableRows: 0,
  moveAnchors: false,
  onMoveAnchorsChange: vi.fn(),
  onAlignEdges: vi.fn(),
  onAlignTops: vi.fn(),
  onDistribute: vi.fn(),
  onApplyRowPitch: vi.fn(),
  onSetColor: vi.fn(),
  onSetPwm: vi.fn(),
  onDelete: vi.fn(),
  onCombineRows: vi.fn(),
  ...overrides,
});

describe('MultiPinPanel', () => {
  it('toggles moving the anchors with the selection', () => {
    const onMoveAnchorsChange = vi.fn();
    const { rerender } = render(<MultiPinPanel {...props({ onMoveAnchorsChange })} />);
    const checkbox = screen.getByRole('checkbox', { name: /Move anchors too/ });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onMoveAnchorsChange).toHaveBeenCalledWith(true);

    rerender(<MultiPinPanel {...props({ moveAnchors: true, onMoveAnchorsChange })} />);
    expect(screen.getByRole('checkbox', { name: /Move anchors too/ })).toBeChecked();
  });
});

describe('MultiPinPanel in Turkish', () => {
  it('shows counts and actions in Turkish', () => {
    render(<LanguageProvider initial='tr'><MultiPinPanel {...props({ combinableRows: 2 })} /></LanguageProvider>);
    expect(screen.getByText('2 pin seçili')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Bağlantı noktalarını da taşı/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tek satırda birleştir \(2 satır\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 pini sil/ })).toBeInTheDocument();
  });
});
