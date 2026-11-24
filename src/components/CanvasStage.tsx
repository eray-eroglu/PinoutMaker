import { useEffect, forwardRef, useState, useRef, useCallback  } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage, Circle, Group, Text } from 'react-konva';
import Konva from 'konva';
import { Maximize } from 'lucide-react';
import type { PinData, LineData, LegendItem, LegendMode } from '../types';
import { LegendPanel } from './LegendPanel';
import type { LoadedImage } from '../utils/project';
import { PinComponent } from './PinComponent';
import { LineComponent } from './LineComponent';
import { calculateManhattanPath } from '../utils/lineUtils';
import { computeResize, getHandlePosition } from '../utils/imageResize';
import { layoutPinLabels } from '../utils/pinLayout';
import { measureLabelText } from '../utils/labelMeasure';
import type { ResizeAnchor } from '../utils/imageResize';
import { HeaderPreview } from './HeaderPreview';
import { constrainToAxis, headerPinPositions } from '../utils/header';
import type { Point } from '../utils/header';
import { pinsInMarquee, primaryOf, rectFromPoints } from '../utils/selection';

interface CanvasStageProps {
  images: LoadedImage[];
  onUpdateImage: (img: LoadedImage, saveHistory?: boolean) => void;
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
  pins: PinData[];
  /** Selected pins; the last one is the primary (last clicked) pin. */
  selectedPinIds: string[];
  /** Index into the primary pin's functions of the label the user picked; -1 = primary label. */
  selectedFunctionIndex: number;
  /**
   * functionIndex: which label of the pin was clicked (-1 = primary label or anchor).
   * toggle: Shift/Ctrl/Cmd+click, adds the pin to or removes it from the selection.
   */
  onSelectPin: (id: string | null, functionIndex?: number, toggle?: boolean) => void;
  /** Marquee: adds these pins to the selection. */
  onAddPinsToSelection: (ids: string[]) => void;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  /** Moves several pins' labels (and anchors with withAnchor) by one offset, as one undo step. */
  onMovePins: (ids: string[], dx: number, dy: number, withAnchor: boolean) => void;
  onDoubleClickPin: (id: string, functionIndex: number) => void;
  lines: LineData[];
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (line: LineData, saveHistory?: boolean) => void;
  isAddingLine?: boolean;
  onCreateLine?: (points: number[]) => void;
  isAddingPin?: boolean;
  onCreatePin?: (x: number, y: number) => void;
  /** Header tool: the user is picking the first and the last pad. */
  isAddingHeader?: boolean;
  /** Pins shown in the live preview while picking the last pad. */
  headerCount?: number;
  onPickHeader?: (start: Point, end: Point) => void;
  /** Header waiting for its settings to be confirmed, with the pins Create would add. */
  headerDraft?: { start: Point; end: Point; pins: PinData[] } | null;
  scale: number;
  setScale: (scale: number) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  gapSize: number;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
  legendMode: LegendMode;
  legendShowCounts: boolean;
  anchorSize: number;
  /** World size of one label unit; see PinData. */
  labelScale: number;
  /** Records an undo snapshot; called before a drag starts. */
  onPushHistory: () => void;
  /** Zooms and pans so all content is visible. */
  onFitToScreen?: () => void;
}

export const CanvasStage = forwardRef<Konva.Stage, CanvasStageProps>(({
  images,
  onUpdateImage,
  selectedImageId,
  onSelectImage,
  pins,
  selectedPinIds,
  selectedFunctionIndex,
  onSelectPin,
  onAddPinsToSelection,
  onUpdatePin,
  onMovePins,
  onDoubleClickPin,
  lines,
  selectedLineId,
  onSelectLine,
  onUpdateLine,
  isAddingLine = false,
  onCreateLine,
  isAddingPin = false,
  onCreatePin,
  isAddingHeader = false,
  headerCount = 10,
  onPickHeader,
  headerDraft = null,
  scale,
  setScale,
  position,
  setPosition,
  gapSize,
  legendItems,
  isLegendVisible,
  legendMode,
  legendShowCounts,
  anchorSize,
  labelScale,
  onPushHistory,
  onFitToScreen,
}, ref) => {

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth - 320,
    height: window.innerHeight - 56
  });

  // In-progress polyline being drawn
  const [inProgressPoints, setInProgressPoints] = useState<number[] | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  // Header tool: first pad picked, and where the last pad would be (follows the mouse)
  const [headerStart, setHeaderStart] = useState<Point | null>(null);
  const [headerEnd, setHeaderEnd] = useState<Point | null>(null);
  const isPlacing = isAddingPin || isAddingLine || isAddingHeader;

  // Shift+drag on empty canvas (or on a board image) draws a selection marquee instead of
  // panning, so while Shift is held the stage and images are not draggable.
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  // While a selected pin is dragged, the other selected pins follow it by this offset
  const [groupDrag, setGroupDrag] = useState<{ id: string; dx: number; dy: number; withAnchor: boolean } | null>(null);

  useEffect(() => {
    const update = (e: KeyboardEvent) => setIsShiftHeld(e.shiftKey);
    // A key released while the window is in the background never sends keyup
    const reset = () => setIsShiftHeld(false);
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('blur', reset);
    };
  }, []);

  const layoutOf = (pin: PinData) => layoutPinLabels(pin, labelScale, gapSize, measureLabelText);
  const selectedPinSet = new Set(selectedPinIds);
  const primaryPinId = primaryOf(selectedPinIds);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 320,
        height: window.innerHeight - 56
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ESC cancels in-progress line
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inProgressPoints) {
        setInProgressPoints(null);
        setMousePos(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inProgressPoints]);

  // Cancel in-progress line when line mode is turned off
  useEffect(() => {
    if (!isAddingLine) {
      setInProgressPoints(null);
      setMousePos(null);
    }
  }, [isAddingLine]);

  // Leaving header mode (Esc, another tool) drops a half-picked header
  useEffect(() => {
    if (!isAddingHeader) {
      setHeaderStart(null);
      setHeaderEnd(null);
    }
  }, [isAddingHeader]);

  const { width, height } = dimensions;

  // Center first image when it loads
  useEffect(() => {
    if (images.length === 1 && scale === 1 && position.x === 0 && position.y === 0) {
      const img = images[0];
      const isVertical = img.rotation % 180 !== 0;
      const displayWidth = isVertical ? img.height : img.width;
      const displayHeight = isVertical ? img.width : img.height;
      const x = (width - displayWidth) / 2;
      const y = (height - displayHeight) / 2;
      
      setPosition({ x: x + displayWidth / 2, y: y + displayHeight / 2 }); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Limit scale
    if (newScale < 0.1 || newScale > 10) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setPosition(newPos);
  };

  const getWorldPos = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pointer);
  }, []);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isAddingHeader) {
      const stage = e.target.getStage();
      const pos = stage && getWorldPos(stage);
      if (!pos) return;
      if (!headerStart) {
        setHeaderStart(pos);
        setHeaderEnd(pos);
        return;
      }
      // Shift keeps the header exactly horizontal or vertical
      const end = e.evt.shiftKey ? constrainToAxis(headerStart, pos) : pos;
      setHeaderStart(null);
      setHeaderEnd(null);
      onPickHeader?.(headerStart, end);
    } else if (isAddingPin && onCreatePin) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = getWorldPos(stage);
      if (!pos) return;
      onCreatePin(pos.x, pos.y);
    } else if (isAddingLine) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = getWorldPos(stage);
      if (!pos) return;

      const now = Date.now();
      const isDoubleClick = now - lastClickTimeRef.current < 350;
      lastClickTimeRef.current = now;

      if (isDoubleClick && inProgressPoints && inProgressPoints.length >= 4) {
        // Double-click: finish the line (drop the last point added by the first click of the double-click)
        const finalPoints = inProgressPoints.slice(0, -2);
        if (finalPoints.length >= 4 && onCreateLine) {
          onCreateLine(finalPoints);
        }
        setInProgressPoints(null);
        setMousePos(null);
        return;
      }

      if (!inProgressPoints) {
        // First click: start a new in-progress line
        setInProgressPoints([pos.x, pos.y]);
      } else {
        // Subsequent clicks: snap to dominant direction (same logic as preview)
        const lastX = inProgressPoints[inProgressPoints.length - 2];
        const lastY = inProgressPoints[inProgressPoints.length - 1];
        const dx = Math.abs(pos.x - lastX);
        const dy = Math.abs(pos.y - lastY);
        // Snap: if moving more horizontally → keep Y, if more vertically → keep X
        const snappedX = dx >= dy ? pos.x : lastX;
        const snappedY = dx >= dy ? lastY : pos.y;
        setInProgressPoints(prev => prev ? [...prev, snappedX, snappedY] : [snappedX, snappedY]);
      }
    } else {
      // Shift+click / the end of a Shift+drag marquee keeps the selection
      if (e.evt.shiftKey) return;
      // Deselect if clicking on empty space (Stage, Grid)
      onSelectPin(null);
      onSelectImage(null);
      if (onSelectLine) onSelectLine(null);
    }
  };

  // The marquee is mirrored in a ref: the window pointerup listener must see the latest corner
  const marqueeRef = useRef(marquee);
  const updateMarquee = (next: typeof marquee) => {
    marqueeRef.current = next;
    setMarquee(next);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!e.evt.shiftKey || e.evt.button !== 0 || isPlacing) return; // Shift also constrains the header tool's axis
    const stage = e.target.getStage();
    // Only on empty canvas or a board image; Shift on a pin or line still toggles / drags it
    if (!stage || (e.target !== stage && e.target.getClassName() !== 'Image')) return;
    const pos = getWorldPos(stage);
    if (!pos) return;
    updateMarquee({ start: pos, end: pos });

    // The button may be released outside the canvas, so listen on the window. Pins and the
    // selection don't change during the drag, so this render's values are current at release.
    const finish = () => {
      const current = marqueeRef.current;
      if (!current) return;
      updateMarquee(null);
      const rect = rectFromPoints(current.start, current.end);
      // A Shift+click without dragging selects nothing
      if (Math.max(rect.width, rect.height) * scale < 3) return;
      const hits = pinsInMarquee(pins, rect, layoutOf);
      if (hits.length > 0) onAddPinsToSelection(hits);
    };
    window.addEventListener('pointerup', finish, { once: true });
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isAddingHeader && headerStart) {
      const stage = e.target.getStage();
      const pos = stage && getWorldPos(stage);
      if (pos) setHeaderEnd(e.evt.shiftKey ? constrainToAxis(headerStart, pos) : pos);
      return;
    }
    const current = marqueeRef.current;
    if (current) {
      const stage = e.target.getStage();
      const pos = stage && getWorldPos(stage);
      if (pos) updateMarquee({ ...current, end: pos });
      return;
    }
    if (!isAddingLine || !inProgressPoints) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getWorldPos(stage);
    if (pos) setMousePos(pos);
  };

  // Alignment Guides
  const [guides, setGuides] = useState<{ vertical: number[], horizontal: number[], gaps: Array<{x: number, y: number, width: number, height: number}> }>({ vertical: [], horizontal: [], gaps: [] });

  // Pins moving together with the dragged one: the whole selection when it is part of it
  const movingPinIds = (id: string) => (selectedPinSet.has(id) ? selectedPinIds : [id]);

  const handlePinDragMove = (id: string, x: number, y: number, isCtrlPressed: boolean) => {
    // If Ctrl is pressed, disable snapping completely
    if (isCtrlPressed) {
      setGuides((prev) => {
        if (prev.vertical.length === 0 && prev.horizontal.length === 0 && prev.gaps.length === 0) {
          return prev;
        }
        return { vertical: [], horizontal: [], gaps: [] };
      });
      return { x, y };
    }

    // Find nearby alignments
    const THRESHOLD = 10 / scale; // Snap within 10 screen pixels
    
    // Actually, fixed world units is much better for printing consistency across zooms.
    const FIXED_GAP = gapSize; // Use the configured gap size
    
    const verticalGuides: number[] = [];
    const horizontalGuides: number[] = [];
    const gapGuides: Array<{x: number, y: number, width: number, height: number}> = [];
    
    let snappedX = x;
    let snappedY = y;

    const currentPin = pins.find(p => p.id === id);
    if (!currentPin) return { x, y };
    // Pins moving along keep their offset to this one, so snapping to them means nothing
    const moving = new Set(movingPinIds(id));

    // All geometry comes from the shared row layout (primary label first, then functions)
    const current = layoutOf({ ...currentPin, x, y });
    const currentPrimary = current.labels[0];
    const isLeftSide = current.side === 'left';
    // The row may extend left of the primary label; keep that offset so snapping can place the row
    const rowLeftOffset = current.bounds.x - x;
    const rowWidth = current.bounds.width;
    const labelHeight = currentPrimary.height;

    pins.forEach(otherPin => {
        if (moving.has(otherPin.id)) return;

        const other = layoutOf(otherPin);
        const otherPrimary = other.labels[0];
        const otherRow = other.bounds;

        // --- GAP SNAPPING (horizontal spacing next to another pin) ---
        // Uses the full rows, so a pin can be placed after another pin's last function label.
        if (Math.abs(otherPin.y - y) < THRESHOLD * 2) {
            const currentRowLeft = x + rowLeftOffset;
            const currentRowRight = currentRowLeft + rowWidth;
            const otherRowRight = otherRow.x + otherRow.width;

            // Dragging current to the RIGHT of otherPin
            if (Math.abs(currentRowLeft - (otherRowRight + FIXED_GAP)) < THRESHOLD) {
                snappedX = otherRowRight + FIXED_GAP - rowLeftOffset;
                snappedY = otherPin.y; // Perfect horizontal align
                horizontalGuides.push(otherPin.y);
                gapGuides.push({ x: otherRowRight, y: otherPin.y, width: FIXED_GAP, height: labelHeight });
            }

            // Dragging current to the LEFT of otherPin
            if (Math.abs(currentRowRight - (otherRow.x - FIXED_GAP)) < THRESHOLD) {
                snappedX = otherRow.x - FIXED_GAP - rowWidth - rowLeftOffset;
                snappedY = otherPin.y;
                horizontalGuides.push(otherPin.y);
                gapGuides.push({ x: otherRow.x - FIXED_GAP, y: otherPin.y, width: FIXED_GAP, height: labelHeight });
            }
        }

        // Horizontal Alignment (y matches)
        if (Math.abs(otherPin.y - y) < THRESHOLD) {
            horizontalGuides.push(otherPin.y);
            snappedY = otherPin.y;
        }

        // --- COLUMN ALIGNMENT (primary labels) ---
        // Labels have a uniform minimum width, so aligning the primary labels' anchor-side edges
        // lines up every function column behind them as well.
        if (isLeftSide && other.side === 'left') {
            // Left of the anchor: align right edges
            const currentRightEdge = x + currentPrimary.width;
            const otherRightEdge = otherPrimary.x + otherPrimary.width;
            if (Math.abs(otherRightEdge - currentRightEdge) < THRESHOLD) {
                snappedX = otherRightEdge - currentPrimary.width;
                verticalGuides.push(otherRightEdge);
            }
        } else if (!isLeftSide && other.side === 'right') {
            // Right of the anchor: align left edges
            if (Math.abs(otherPrimary.x - x) < THRESHOLD) {
                verticalGuides.push(otherPrimary.x);
                snappedX = otherPrimary.x;
            }
        }
    });

    setGuides((prev) => {
        const next = { vertical: verticalGuides, horizontal: horizontalGuides, gaps: gapGuides };
        // Deep stringify equality check since it's just arrays of numbers/small objects
        if (JSON.stringify(prev) === JSON.stringify(next)) {
            return prev;
        }
        return next;
    });
    
    // Return snapped position
    return { x: snappedX, y: snappedY };
  };

  /** Snapping applies to the dragged pin; the rest of the selection follows with the same offset. */
  const handleGroupDragMove = (id: string, x: number, y: number, isCtrlPressed: boolean, withAnchor = false) => {
    const snapped = handlePinDragMove(id, x, y, isCtrlPressed);
    const pin = pins.find(p => p.id === id);
    if (pin && movingPinIds(id).length > 1) {
      setGroupDrag({ id, dx: snapped.x - pin.x, dy: snapped.y - pin.y, withAnchor });
    }
    return snapped;
  };

  const handleRowDragEnd = (id: string, dx: number, dy: number, withAnchor: boolean) => {
    setGroupDrag(null);
    if (dx === 0 && dy === 0) return;
    onMovePins(movingPinIds(id), dx, dy, withAnchor);
  };

  const handlePinDragEnd = () => {
      setGuides((prev) => {
          if (prev.vertical.length === 0 && prev.horizontal.length === 0 && prev.gaps.length === 0) {
              return prev;
          }
          return { vertical: [], horizontal: [], gaps: [] };
      });
  };

  // Grid generation
  const gridSize = 50;
  const GRID_LIMIT = 2000; // 4000x4000 area
  const gridLines = [];

  for (let i = -GRID_LIMIT; i <= GRID_LIMIT; i += gridSize) {
    // Vertical
    gridLines.push(
      <Line
        key={`v-${i}`}
        points={[i, -GRID_LIMIT, i, GRID_LIMIT]}
        stroke='#e5e7eb' // gray-200
        strokeWidth={1}
        listening={false}
      />
    );
    // Horizontal
    gridLines.push(
      <Line
        key={`h-${i}`}
        points={[-GRID_LIMIT, i, GRID_LIMIT, i]}
        stroke='#e5e7eb' // gray-200
        strokeWidth={1}
        listening={false}
      />
    );
  }

  return (
    <div 
      className='flex-1 bg-gray-50 relative overflow-hidden'
      style={{ cursor: isPlacing ? 'crosshair' : 'default' }}
    >
      <Stage
        width={width}
        height={height}
        draggable={!isPlacing && !isShiftHeld}
        onWheel={handleWheel}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onDragEnd={(e) => {
          // Only update position if the stage itself was dragged
          if (e.target === e.target.getStage()) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        ref={ref}
      >
        <Layer name="grid-layer" listening={false}>
          {gridLines}
        </Layer>
        <Layer name="content-layer">
          {images.map(img => {
            const isSelected = selectedImageId === img.id;
            // Handle radius scaled inversely so it stays visually constant
            const HR = 6 / scale;
            const handles: Array<{ anchor: ResizeAnchor; cursor: string }> = [
              { anchor: 'tl', cursor: 'nwse-resize' },
              { anchor: 'tr', cursor: 'nesw-resize' },
              { anchor: 'bl', cursor: 'nesw-resize' },
              { anchor: 'br', cursor: 'nwse-resize' },
              { anchor: 't', cursor: 'ns-resize' },
              { anchor: 'b', cursor: 'ns-resize' },
              { anchor: 'l', cursor: 'ew-resize' },
              { anchor: 'r', cursor: 'ew-resize' },
            ];
            const selectThisImage = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
              // In pin/line/header mode the click must reach the stage, which places the point.
              // Shift is the marquee modifier: a Shift+click (or the end of a marquee) never selects the image.
              if (isPlacing || e.evt.shiftKey) return;
              e.cancelBubble = true;
              onSelectImage(img.id);
              onSelectPin(null);
              if (onSelectLine) onSelectLine(null);
            };

            return (
              <Group key={img.id}>
                <KonvaImage
                  // An image that could not be loaded stays as a grey placeholder (see LoadedImage)
                  image={img.element ?? undefined}
                  fill={img.element ? undefined : '#e5e7eb'}
                  dash={img.element ? undefined : [8 / scale, 6 / scale]}
                  width={img.width}
                  height={img.height}
                  rotation={img.rotation}
                  draggable={!isPlacing && !isShiftHeld}
                  onClick={selectThisImage}
                  onTap={selectThisImage}
                  // History is recorded before the drag so undo returns to the original spot
                  onDragStart={() => onPushHistory()}
                  onDragMove={(e) => {
                    onUpdateImage({ ...img, x: e.target.x(), y: e.target.y() }, false);
                  }}
                  onDragEnd={(e) => {
                    onUpdateImage({ ...img, x: e.target.x(), y: e.target.y() }, false);
                  }}
                  stroke={isSelected ? '#3b82f6' : img.element ? undefined : '#9ca3af'}
                  strokeWidth={isSelected || !img.element ? 2 / scale : 0}
                  // Set the origin to the center of the image
                  offsetX={img.width / 2}
                  offsetY={img.height / 2}
                  x={img.x}
                  y={img.y}
                />
                {!img.element && (
                  <Text
                    text='Image could not be loaded'
                    x={img.x}
                    y={img.y}
                    width={img.width}
                    height={img.height}
                    offsetX={img.width / 2}
                    offsetY={img.height / 2}
                    rotation={img.rotation}
                    align='center'
                    verticalAlign='middle'
                    fontSize={Math.max(8, Math.min(img.width, img.height) / 14)}
                    fill='#6b7280'
                    listening={false}
                  />
                )}
                {isSelected && handles.map(handle => {
                  const pos = getHandlePosition(img, handle.anchor);
                  return (
                    <Circle
                      key={`${img.id}-handle-${handle.anchor}`}
                      x={pos.x}
                      y={pos.y}
                      radius={HR}
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth={1.5 / scale}
                      draggable
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = handle.cursor;
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      onDragStart={(e) => {
                        e.cancelBubble = true;
                        onPushHistory();
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const node = e.target;
                        const { box, handle: pinned } = computeResize(img, handle.anchor, node.x(), node.y());
                        // Keep the handle on the constrained (aspect-locked) corner/edge
                        node.position(pinned);
                        onUpdateImage({ ...img, ...box }, false);
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                      }}
                    />
                  );
                })}
              </Group>
            );
          })}
          {pins.map((pin) => (
            <PinComponent
              key={pin.id}
              pin={pin}
              labelScale={labelScale}
              gapSize={gapSize}
              isSelected={selectedPinSet.has(pin.id)}
              // The picked label only matters for the single-pin editor
              selectedFunctionIndex={selectedPinIds.length === 1 && pin.id === primaryPinId ? selectedFunctionIndex : null}
              followOffset={groupDrag && groupDrag.id !== pin.id && selectedPinSet.has(pin.id) ? groupDrag : null}
              onSelect={(id, functionIndex, e) => {
                onSelectPin(id, functionIndex, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
                onSelectImage(null);
                if (onSelectLine) onSelectLine(null);
              }}
              onUpdate={onUpdatePin}
              onDoubleClick={onDoubleClickPin}
              onDragMove={handleGroupDragMove}
              onDragEnd={handlePinDragEnd}
              onRowDragEnd={handleRowDragEnd}
              anchorSize={anchorSize}
            />
          ))}
          {lines.map((line) => (
            <LineComponent
              key={line.id}
              line={line}
              scale={scale}
              labelScale={labelScale}
              isSelected={line.id === selectedLineId}
              onSelect={(id) => {
                if (onSelectLine) onSelectLine(id);
                onSelectImage(null);
                onSelectPin(null);
              }}
              onUpdate={onUpdateLine}
            />
          ))}
          {/* Alignment Guides */}
          {guides.gaps.map((g, i) => (
             <Rect
                key={`gap-r-${i}`}
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                fill="rgba(59, 130, 246, 0.4)" // Blue gap box
                stroke="#2563eb"
                strokeWidth={1 / scale}
                listening={false}
             />
          ))}
          {guides.vertical.map((gx, i) => (
             <Line
                key={`gv-${i}`}
                points={[gx, -GRID_LIMIT, gx, GRID_LIMIT]}
                stroke='red'
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
             />
          ))}
          {guides.horizontal.map((gy, i) => (
             <Line
                key={`gh-${i}`}
                points={[-GRID_LIMIT, gy, GRID_LIMIT, gy]}
                stroke='red'
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
             />
          ))}
          {/* Selection marquee (screen-constant dashed outline) */}
          {marquee && (() => {
            const r = rectFromPoints(marquee.start, marquee.end);
            return (
              <Rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="rgba(59, 130, 246, 0.08)"
                stroke="#2563eb"
                strokeWidth={1 / scale}
                dash={[4 / scale, 4 / scale]}
                listening={false}
              />
            );
          })()}
          {/* In-progress polyline preview */}
          {inProgressPoints && inProgressPoints.length >= 2 && mousePos && (() => {
            // Confirmed segments (already clicked): render as Manhattan (L-shape)
            const confirmedPts: number[] = [];
            for (let i = 0; i < inProgressPoints.length - 2; i += 2) {
              const seg = calculateManhattanPath(
                inProgressPoints[i], inProgressPoints[i + 1],
                inProgressPoints[i + 2], inProgressPoints[i + 3]
              );
              if (i === 0) confirmedPts.push(...seg);
              else confirmedPts.push(...seg.slice(2));
            }
            // Current segment: snap to dominant direction (horizontal OR vertical, no diagonal)
            const lastX = inProgressPoints[inProgressPoints.length - 2];
            const lastY = inProgressPoints[inProgressPoints.length - 1];
            const dx = Math.abs(mousePos.x - lastX);
            const dy = Math.abs(mousePos.y - lastY);
            const previewPts = dx >= dy
              ? [lastX, lastY, mousePos.x, lastY]   // horizontal
              : [lastX, lastY, lastX, mousePos.y];  // vertical

            return (
              <>
                {confirmedPts.length >= 4 && (
                  <Line
                    points={confirmedPts}
                    stroke="#1f2937"
                    strokeWidth={2 * labelScale}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                    opacity={0.7}
                  />
                )}
                <Line
                  points={previewPts}
                  stroke="#1f2937"
                  strokeWidth={2 * labelScale}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                  opacity={0.4}
                />
              </>
            );
          })()}
          {headerStart && headerEnd && (
            <HeaderPreview
              start={headerStart}
              end={headerEnd}
              anchors={headerPinPositions(headerStart, headerEnd, headerCount)}
              scale={scale}
              labelScale={labelScale}
              gapSize={gapSize}
              anchorSize={anchorSize}
            />
          )}
          {headerDraft && (
            <HeaderPreview
              start={headerDraft.start}
              end={headerDraft.end}
              anchors={headerDraft.pins.map(p => ({ x: p.targetX, y: p.targetY }))}
              ghostPins={headerDraft.pins}
              scale={scale}
              labelScale={labelScale}
              gapSize={gapSize}
              anchorSize={anchorSize}
            />
          )}
          {/* Start-point dot */}
          {inProgressPoints && inProgressPoints.length >= 2 && (
            <Line
              points={[inProgressPoints[0], inProgressPoints[1], inProgressPoints[0], inProgressPoints[1]]}
              stroke="#1f2937"
              strokeWidth={8 / scale}
              lineCap="round"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      <div className='absolute bottom-2 right-2 flex items-center gap-1 text-gray-500 text-xs bg-white/80 p-1 rounded shadow'>
        <span className='pointer-events-none'>Scale: {scale.toFixed(2)}x</span>
        {onFitToScreen && (
          <button
            type='button'
            onClick={onFitToScreen}
            title='Fit to screen (Shift+1)'
            aria-label='Fit to screen'
            className='p-0.5 rounded hover:bg-gray-200 text-gray-600'
          >
            <Maximize size={14} />
          </button>
        )}
      </div>

      {/* Legend Panel */}
      {isLegendVisible && (
        <LegendPanel legendItems={legendItems} pins={pins} mode={legendMode} showCounts={legendShowCounts} />
      )}
    </div>
  );
});
