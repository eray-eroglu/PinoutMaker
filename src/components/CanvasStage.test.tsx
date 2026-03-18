import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasStage } from './CanvasStage';
import type { PinData } from '../types';

let capturedDragMove: (id: string, x: number, y: number, isCtrlPressed: boolean) => { x: number, y: number } | void;
let capturedDragEnd: () => void;

vi.mock('react-konva', () => {
  return {
    Stage: ({ children }: any) => <div data-testid="stage">{children}</div>,
    Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
    Line: (props: any) => (
      <div 
        data-testid="konva-line" 
        data-is-guide={props.stroke === 'red'} 
      />
    ),
    Rect: () => <div data-testid="konva-rect" />,
    Image: () => <div data-testid="konva-image" />,
  };
});

vi.mock('./PinComponent', () => {
  return {
    PinComponent: (props: any) => {
      capturedDragMove = props.onDragMove;
      capturedDragEnd = props.onDragEnd;
      return <div data-testid={`pin-${props.pin.id}`} />;
    }
  };
});

describe('CanvasStage - Drag Snapping (Magnets)', () => {
  const dummyPins: PinData[] = [
    {
      id: 'pin-1',
      text: 'VCC',
      isPwm: false,
      color: '#dc2626',
      x: 100,
      y: 100,
      targetX: 150,
      targetY: 100,
      labelWidth: 60,
    },
    {
      id: 'pin-2',
      text: 'GND',
      isPwm: false,
      color: '#000000',
      x: 100,
      y: 200,
      targetX: 150,
      targetY: 200,
      labelWidth: 60,
    }
  ];

  const defaultProps = {
    image: null,
    imageRotation: 0,
    pins: dummyPins,
    selectedPinId: null,
    onSelectPin: vi.fn(),
    onUpdatePin: vi.fn(),
    onDoubleClickPin: vi.fn(),
    scale: 1,
    setScale: vi.fn(),
    position: { x: 0, y: 0 },
    setPosition: vi.fn(),
    gapSize: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and captures PinComponent handlers', () => {
    render(<CanvasStage {...defaultProps} />);
    expect(capturedDragMove).toBeDefined();
    expect(capturedDragEnd).toBeDefined();
  });

  it('snaps to alignment when dragging normally near another pin', () => {
    const { container } = render(<CanvasStage {...defaultProps} />);

    // Trigger drag move for pin-2, moving its Y close to pin-1's Y (100)
    // Snap threshold is 10/scale = 10. Moving it to y=105 should snap it to 100.
    act(() => {
      const result = capturedDragMove('pin-2', 100, 105, false) as { x: number; y: number };
      expect(result.y).toBe(100); // Snapped!
    });

    // Check if guide line is rendered (red line)
    const guideLines = container.querySelectorAll('div[data-testid="konva-line"][data-is-guide="true"]');
    expect(guideLines.length).toBeGreaterThan(0);
  });

  it('disables snapping and guides when Ctrl is pressed', () => {
    const { container } = render(<CanvasStage {...defaultProps} />);

    // Trigger drag move for pin-2, moving its Y close to pin-1's Y (100), but with Ctrl pressed!
    act(() => {
      const result = capturedDragMove('pin-2', 100, 105, true) as { x: number; y: number };
      expect(result.y).toBe(105); // Should NOT snap!
      expect(result.x).toBe(100);
    });

    // There should be NO guide line rendered
    const guideLines = container.querySelectorAll('div[data-testid="konva-line"][data-is-guide="true"]');
    expect(guideLines.length).toBe(0);
  });

  it('clears guides when drag ends', () => {
    const { container } = render(<CanvasStage {...defaultProps} />);

    // Trigger drag move with snapping
    act(() => {
      capturedDragMove('pin-2', 100, 105, false);
    });

    // Verify guides exist
    let guideLines = container.querySelectorAll('div[data-testid="konva-line"][data-is-guide="true"]');
    expect(guideLines.length).toBeGreaterThan(0);

    // End drag
    act(() => {
      capturedDragEnd();
    });

    // Verify guides cleared
    guideLines = container.querySelectorAll('div[data-testid="konva-line"][data-is-guide="true"]');
    expect(guideLines.length).toBe(0);
  });
});
