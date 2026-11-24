import type { ComponentProps, ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasStage } from './CanvasStage';
import type { PinData } from '../types';
import type { PinComponent as PinComponentType } from './PinComponent';

let capturedDragMove: (id: string, x: number, y: number, isCtrlPressed: boolean, withAnchor: boolean) => { x: number, y: number } | void;
let capturedDragEnd: () => void;
// Latest props each PinComponent was rendered with, by pin id
const pinProps = new Map<string, ComponentProps<typeof PinComponentType>>();

vi.mock('react-konva', () => {
  return {
    Stage: ({ children }: { children?: ReactNode }) => <div data-testid="stage">{children}</div>,
    Layer: ({ children }: { children?: ReactNode }) => <div data-testid="layer">{children}</div>,
    Line: (props: { stroke?: string }) => (
      <div
        data-testid="konva-line"
        data-is-guide={props.stroke === 'red'}
      />
    ),
    Rect: () => <div data-testid="konva-rect" />,
    Image: () => <div data-testid="konva-image" />,
    Text: () => <div data-testid="konva-text" />,
    Group: ({ children, listening }: { children?: ReactNode; listening?: boolean }) => (
      <div data-testid="konva-group" data-listening={String(listening ?? true)}>{children}</div>
    ),
  };
});

// Every label measures 60 label units (the minimum width), independent of the font
vi.mock('../utils/labelMeasure', () => ({ measureLabelText: () => 60 }));

vi.mock('./PinComponent', () => {
  return {
    PinComponent: (props: ComponentProps<typeof PinComponentType>) => {
      capturedDragMove = props.onDragMove!;
      capturedDragEnd = props.onDragEnd!;
      pinProps.set(props.pin.id, props);
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

  const defaultProps: ComponentProps<typeof CanvasStage> = {
    images: [],
    onUpdateImage: vi.fn(),
    selectedImageId: null,
    onSelectImage: vi.fn(),
    pins: dummyPins,
    legendMode: 'all',
    legendShowCounts: false,
    selectedPinIds: [],
    selectedFunctionIndex: -1,
    onSelectPin: vi.fn(),
    onAddPinsToSelection: vi.fn(),
    onUpdatePin: vi.fn(),
    onMovePins: vi.fn(),
    onDoubleClickPin: vi.fn(),
    isAddingPin: false,
    onCreatePin: vi.fn(),
    scale: 1,
    setScale: vi.fn(),
    position: { x: 0, y: 0 },
    setPosition: vi.fn(),
    gapSize: 20,
    legendItems: [],
    isLegendVisible: true,
    anchorSize: 5,
    labelScale: 1,
    lines: [],
    selectedLineId: null,
    onSelectLine: vi.fn(),
    onUpdateLine: vi.fn(),
    isAddingLine: false,
    onCreateLine: vi.fn(),
    onPushHistory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pinProps.clear();
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
      const result = capturedDragMove('pin-2', 100, 105, false, false) as { x: number; y: number };
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
      const result = capturedDragMove('pin-2', 100, 105, true, false) as { x: number; y: number };
      expect(result.y).toBe(105); // Should NOT snap!
      expect(result.x).toBe(100);
    });

    // There should be NO guide line rendered
    const guideLines = container.querySelectorAll('div[data-testid="konva-line"][data-is-guide="true"]');
    expect(guideLines.length).toBe(0);
  });

  it('gap-snaps next to the end of another pin\'s function row, not just its primary label', () => {
    // pin-a is right of its anchor: labels at x 100-160, 180-240, 260-320 (gap 20)
    const rowPins: PinData[] = [
      {
        id: 'pin-a', text: 'PB7', isPwm: false, color: '#0d9488', x: 100, y: 100, targetX: 50, targetY: 110,
        functions: [
          { id: 'f1', text: 'SDA1', color: '#0ea5e9' },
          { id: 'f2', text: 'RXD1', color: '#1d4ed8' },
        ],
      },
      { id: 'pin-b', text: 'PB6', isPwm: false, color: '#0d9488', x: 500, y: 300, targetX: 0, targetY: 300 },
    ];
    const { container } = render(<CanvasStage {...defaultProps} pins={rowPins} />);

    act(() => {
      const result = capturedDragMove('pin-b', 343, 103, false, false) as { x: number; y: number };
      expect(result).toEqual({ x: 340, y: 100 }); // 320 (row end) + gap 20
    });
    expect(container.querySelectorAll('div[data-testid="konva-rect"]').length).toBeGreaterThan(0);
  });

  it('clears guides when drag ends', () => {
    const { container } = render(<CanvasStage {...defaultProps} />);

    // Trigger drag move with snapping
    act(() => {
      capturedDragMove('pin-2', 100, 105, false, false);
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

  describe('group drag', () => {
    const threePins: PinData[] = [
      ...dummyPins,
      { id: 'pin-3', text: 'PA0', isPwm: false, color: '#0d9488', x: 100, y: 300, targetX: 150, targetY: 300 },
    ];

    it('makes the other selected pins follow the dragged one, and drops them all in one move', () => {
      const onMovePins = vi.fn();
      render(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-1', 'pin-3']} onMovePins={onMovePins} />);

      // Ctrl: no snapping, so the offset is exactly the drag
      act(() => {
        pinProps.get('pin-1')!.onDragMove!('pin-1', 130, 140, true, false);
      });
      expect(pinProps.get('pin-3')!.followOffset).toMatchObject({ dx: 30, dy: 40, withAnchor: false });
      expect(pinProps.get('pin-1')!.followOffset).toBeNull(); // the dragged pin moves itself
      expect(pinProps.get('pin-2')!.followOffset).toBeNull(); // not selected

      act(() => {
        pinProps.get('pin-1')!.onRowDragEnd('pin-1', 30, 40, false);
      });
      expect(onMovePins).toHaveBeenCalledTimes(1);
      expect(onMovePins).toHaveBeenCalledWith(['pin-1', 'pin-3'], 30, 40, false);
      expect(pinProps.get('pin-3')!.followOffset).toBeNull();
    });

    it('passes Alt (whole-pin move) through to the followers and the drop', () => {
      const onMovePins = vi.fn();
      render(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-1', 'pin-3']} onMovePins={onMovePins} />);
      act(() => {
        pinProps.get('pin-1')!.onDragMove!('pin-1', 110, 100, true, true);
      });
      expect(pinProps.get('pin-3')!.followOffset).toMatchObject({ dx: 10, dy: 0, withAnchor: true });
      act(() => {
        pinProps.get('pin-1')!.onRowDragEnd('pin-1', 10, 0, true);
      });
      expect(onMovePins).toHaveBeenCalledWith(['pin-1', 'pin-3'], 10, 0, true);
    });

    it('moves only the dragged pin when it is not part of the selection', () => {
      const onMovePins = vi.fn();
      render(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-1', 'pin-3']} onMovePins={onMovePins} />);
      act(() => {
        pinProps.get('pin-2')!.onDragMove!('pin-2', 120, 260, true, false);
      });
      expect(pinProps.get('pin-1')!.followOffset).toBeNull();
      act(() => {
        pinProps.get('pin-2')!.onRowDragEnd('pin-2', 20, 60, false);
      });
      expect(onMovePins).toHaveBeenCalledWith(['pin-2'], 20, 60, false);
    });

    it('does not snap the dragged pin to pins that move along with it', () => {
      // pin-2 (y 200) is selected too, so dragging pin-1 to y 205 must not snap to it
      render(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-1', 'pin-2']} />);
      act(() => {
        const result = pinProps.get('pin-1')!.onDragMove!('pin-1', 100, 205, false, false) as { x: number; y: number };
        expect(result.y).toBe(205);
      });
    });

    it('highlights all selected pins but only shows the picked label for a single selection', () => {
      const { rerender } = render(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-1', 'pin-3']} />);
      expect(['pin-1', 'pin-2', 'pin-3'].map(id => pinProps.get(id)!.isSelected)).toEqual([true, false, true]);
      expect(pinProps.get('pin-3')!.selectedFunctionIndex).toBeNull();
      rerender(<CanvasStage {...defaultProps} pins={threePins} selectedPinIds={['pin-3']} />);
      expect(pinProps.get('pin-3')!.selectedFunctionIndex).toBe(-1);
      expect(pinProps.get('pin-1')!.selectedFunctionIndex).toBeNull();
    });
  });

  describe('placing tools', () => {
    const pinLayer = (container: HTMLElement) =>
      container.querySelector('[data-testid="pin-pin-1"]')!.closest('[data-testid="konva-group"]') as HTMLElement;

    it.each(['isAddingPin', 'isAddingLine', 'isAddingHeader'] as const)(
      'lets clicks on pins and lines through to the stage while %s',
      tool => {
        const { container } = render(<CanvasStage {...defaultProps} {...{ [tool]: true }} />);
        expect(pinLayer(container).dataset.listening).toBe('false');
      },
    );

    it('pins and lines take clicks when no tool is active', () => {
      const { container } = render(<CanvasStage {...defaultProps} />);
      expect(pinLayer(container).dataset.listening).toBe('true');
    });
  });
});
