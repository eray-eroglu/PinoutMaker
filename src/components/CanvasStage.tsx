import { useEffect, forwardRef, useState, useRef, useCallback  } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage, Circle, Group } from 'react-konva';
import Konva from 'konva';
import { Maximize } from 'lucide-react';
import type { PinData, LineData, LegendItem } from '../types';
import type { LoadedImage } from '../utils/project';
import { PinComponent } from './PinComponent';
import { LineComponent } from './LineComponent';
import { calculateManhattanPath } from '../utils/lineUtils';
import { computeResize, getHandlePosition } from '../utils/imageResize';
import type { ResizeAnchor } from '../utils/imageResize';

interface CanvasStageProps {
  images: LoadedImage[];
  onUpdateImage: (img: LoadedImage, saveHistory?: boolean) => void;
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
  pins: PinData[];
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  onDoubleClickPin: (id: string, currentText: string) => void;
  lines: LineData[];
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (line: LineData, saveHistory?: boolean) => void;
  isAddingLine?: boolean;
  onCreateLine?: (points: number[]) => void;
  isAddingPin?: boolean;
  onCreatePin?: (x: number, y: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  gapSize: number;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
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
  selectedPinId,
  onSelectPin,
  onUpdatePin,
  onDoubleClickPin,
  lines,
  selectedLineId,
  onSelectLine,
  onUpdateLine,
  isAddingLine = false,
  onCreateLine,
  isAddingPin = false,
  onCreatePin,
  scale,
  setScale,
  position,
  setPosition,
  gapSize,
  legendItems,
  isLegendVisible,
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
    if (isAddingPin && onCreatePin) {
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
      // Deselect if clicking on empty space (Stage, Grid)
      onSelectPin(null);
      onSelectImage(null);
      if (onSelectLine) onSelectLine(null);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isAddingLine || !inProgressPoints) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getWorldPos(stage);
    if (pos) setMousePos(pos);
  };

  // Alignment Guides
  const [guides, setGuides] = useState<{ vertical: number[], horizontal: number[], gaps: Array<{x: number, y: number, width: number, height: number}> }>({ vertical: [], horizontal: [], gaps: [] });

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

    // Determine if the pin is on the left side of its anchor
    const isLeftSide = x < currentPin.targetX;
    
    // Label sizes are stored in label units; convert to world coordinates
    const currentWorldWidth = (currentPin.labelWidth || 60) * labelScale;
    const currentWorldHeight = (currentPin.labelHeight || 26) * labelScale;

    // 1. Standard Alignment (Snap to common existing X or Y)
    pins.forEach(otherPin => {
        if (otherPin.id === id) return;

        const otherWorldWidth = (otherPin.labelWidth || 60) * labelScale;
        const otherLeftEdge = otherPin.x;
        const otherRightEdge = otherPin.x + otherWorldWidth;

        // --- GAP SNAPPING (Horizontal spacing next to another pin) ---
        // If they are somewhat vertically aligned (Y is close)
        if (Math.abs(otherPin.y - y) < THRESHOLD * 2) { 
            const currentLeftEdge = x;
            const currentRightEdge = x + currentWorldWidth;

            // Dragging current to the RIGHT of otherPin
            if (Math.abs(currentLeftEdge - (otherRightEdge + FIXED_GAP)) < THRESHOLD) {
                snappedX = otherRightEdge + FIXED_GAP;
                snappedY = otherPin.y; // Perfect horizontal align
                horizontalGuides.push(otherPin.y);
                gapGuides.push({
                   x: otherRightEdge,
                   y: otherPin.y,
                   width: FIXED_GAP,
                   height: currentWorldHeight
                });
            }

            // Dragging current to the LEFT of otherPin
            if (Math.abs(currentRightEdge - (otherLeftEdge - FIXED_GAP)) < THRESHOLD) {
                snappedX = otherLeftEdge - FIXED_GAP - currentWorldWidth;
                snappedY = otherPin.y;
                horizontalGuides.push(otherPin.y);
                gapGuides.push({
                   x: otherLeftEdge - FIXED_GAP,
                   y: otherPin.y,
                   width: FIXED_GAP,
                   height: currentWorldHeight
                });
            }
        }

        // Horizontal Alignment (y matches)
        if (Math.abs(otherPin.y - y) < THRESHOLD) {
            horizontalGuides.push(otherPin.y);
            snappedY = otherPin.y; 
        }

        // Vertical Alignment
        // If the pin is on the left side, we want to align its RIGHT edge with other left-side pins.
        // Since we don't have exact rendered widths in state, we can use the labelWidth property
        // if it exists, or estimate it.
        // For now, we will align the left edges (x) for right-side pins,
        // and for left-side pins, we will try to align their right edges if we know their widths.
        
        const otherIsLeftSide = otherPin.x < otherPin.targetX;

        if (isLeftSide && otherIsLeftSide) {
            // Both on left side. Try to align right edges.
            // Right edge = x + width
            // We need: x + currentWidth = otherPin.x + otherWidth
            // So: x = otherPin.x + otherWidth - currentWidth
            
            // If we have the widths saved in the pin data (we added this to types.ts earlier)
            if (currentPin.labelWidth && otherPin.labelWidth) {
                // Convert unscaled labelWidth to world coordinates
                const currentWorldWidth = currentPin.labelWidth * labelScale;
                const otherWorldWidth = otherPin.labelWidth * labelScale;

                const currentRightEdge = x + currentWorldWidth;
                const otherRightEdge = otherPin.x + otherWorldWidth;
                
                if (Math.abs(otherRightEdge - currentRightEdge) < THRESHOLD) {
                    // Snap right edges
                    snappedX = otherPin.x + otherWorldWidth - currentWorldWidth;
                    // Draw guide at the right edge
                    verticalGuides.push(otherRightEdge);
                }
            } else {
                // Fallback to left edge alignment if widths are unknown
                if (Math.abs(otherPin.x - x) < THRESHOLD) {
                    verticalGuides.push(otherPin.x);
                    snappedX = otherPin.x;
                }
            }
        } else if (!isLeftSide && !otherIsLeftSide) {
            // Both on right side. Align left edges (standard).
            if (Math.abs(otherPin.x - x) < THRESHOLD) {
                verticalGuides.push(otherPin.x);
                snappedX = otherPin.x;
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
      style={{ cursor: isAddingPin || isAddingLine ? 'crosshair' : 'default' }}
    >
      <Stage
        width={width}
        height={height}
        draggable={!isAddingPin && !isAddingLine}
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
              // In pin/line mode the click must reach the stage, which places the pin or line point
              if (isAddingPin || isAddingLine) return;
              e.cancelBubble = true;
              onSelectImage(img.id);
              onSelectPin(null);
              if (onSelectLine) onSelectLine(null);
            };

            return (
              <Group key={img.id}>
                <KonvaImage
                  image={img.element}
                  width={img.width}
                  height={img.height}
                  rotation={img.rotation}
                  draggable={!isAddingPin && !isAddingLine}
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
                  stroke={isSelected ? '#3b82f6' : undefined}
                  strokeWidth={isSelected ? 2 / scale : 0}
                  // Set the origin to the center of the image
                  offsetX={img.width / 2}
                  offsetY={img.height / 2}
                  x={img.x}
                  y={img.y}
                />
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
              isSelected={pin.id === selectedPinId}
              onSelect={(id) => {
                onSelectPin(id);
                onSelectImage(null);
                if (onSelectLine) onSelectLine(null);
              }}
              onUpdate={onUpdatePin}
              onDoubleClick={onDoubleClickPin}
              onDragMove={(id, x, y, isCtrlPressed) => handlePinDragMove(id, x, y, isCtrlPressed)}
              onDragEnd={handlePinDragEnd}
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
        <div className="absolute top-4 left-4 bg-[#e6e6e6] border border-gray-300 rounded shadow-md p-2 w-48 pointer-events-none opacity-90">
          <h3 className="text-xs font-normal text-gray-600 mb-2 uppercase tracking-wider">TABLE</h3>
          <div className="flex flex-col gap-[2px]">
            {legendItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-center text-white text-[10px] font-normal py-1 border border-black/50"
                style={{ backgroundColor: item.color }}
              >
                {item.text}
              </div>
            ))}
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-300 flex flex-col gap-1 text-[10px] text-gray-600">
            <div className="flex items-center gap-2">
              <svg width="20" height="10" className="overflow-visible">
                <path d="M 0 5 L 20 5" stroke="black" strokeWidth="1" />
              </svg>
              <span>Standard Pin</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="10" className="overflow-visible">
                <path d="M 0 5 Q 5 0, 10 5 T 20 5" stroke="black" strokeWidth="1" fill="none" />
              </svg>
              <span>PWM Pin</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
