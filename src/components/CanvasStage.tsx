import { useEffect, forwardRef, useState  } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage  } from 'react-konva';
import Konva from 'konva';
import type { PinData, LegendItem } from '../types';
import type { LoadedImage } from '../App';
import { PinComponent } from './PinComponent';

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
  isAddingPin?: boolean;
  onCreatePin?: (x: number, y: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  gapSize: number;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
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
  isAddingPin = false,
  onCreatePin,
  scale,
  setScale,
  position,
  setPosition,
  gapSize,
  legendItems,
  isLegendVisible
}, ref) => {

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth - 320,
    height: window.innerHeight - 56
  });

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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isAddingPin && onCreatePin) {
      const stage = e.target.getStage();
      if (!stage) return;
      
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const transform = stage.getAbsoluteTransform().copy().invert();
      const pos = transform.point(pointer);
      
      onCreatePin(pos.x, pos.y);
    } else {
      // Deselect if clicking on empty space (Stage, Grid)
      onSelectPin(null);
      onSelectImage(null);
    }
  };

  // Alignment Guides
  const [guides, setGuides] = useState<{ vertical: number[], horizontal: number[], gaps: Array<{x: number, y: number, width: number}> }>({ vertical: [], horizontal: [], gaps: [] });

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
    const gapGuides: Array<{x: number, y: number, width: number}> = [];
    
    let snappedX = x;
    let snappedY = y;

    const currentPin = pins.find(p => p.id === id);
    if (!currentPin) return { x, y };

    // Determine if the pin is on the left side of its anchor
    const isLeftSide = x < currentPin.targetX;
    
    // Convert unscaled labelWidth to world coordinates for current pin
    const currentWorldWidth = (currentPin.labelWidth || 60) / scale;

    // 1. Standard Alignment (Snap to common existing X or Y)
    pins.forEach(otherPin => {
        if (otherPin.id === id) return;
        
        const otherWorldWidth = (otherPin.labelWidth || 60) / scale;
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
                   width: FIXED_GAP
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
                   width: FIXED_GAP
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
                const currentWorldWidth = currentPin.labelWidth / scale;
                const otherWorldWidth = otherPin.labelWidth / scale;

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
  const lines = [];

  for (let i = -GRID_LIMIT; i <= GRID_LIMIT; i += gridSize) {
    // Vertical
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i, -GRID_LIMIT, i, GRID_LIMIT]}
        stroke='#e5e7eb' // gray-200
        strokeWidth={1}
        listening={false}
      />
    );
    // Horizontal
    lines.push(
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
      style={{ cursor: isAddingPin ? 'crosshair' : 'default' }}
    >
      <Stage
        width={width}
        height={height}
        draggable={!isAddingPin}
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
        ref={ref}
      >
        <Layer name="grid-layer">
          {lines}
        </Layer>
        <Layer name="content-layer">
          {images.map(img => (
            <KonvaImage
              key={img.id}
              image={img.element}
              rotation={img.rotation}
              draggable={!isAddingPin}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectImage(img.id);
                onSelectPin(null);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onSelectImage(img.id);
                onSelectPin(null);
              }}
              onDragEnd={(e) => {
                const node = e.target;
                onUpdateImage({ ...img, x: node.x(), y: node.y() });
              }}
              stroke={selectedImageId === img.id ? '#3b82f6' : undefined}
              strokeWidth={selectedImageId === img.id ? 2 / scale : 0}
              // Set the origin to the center of the image
              offsetX={img.width / 2}
              offsetY={img.height / 2}
              x={img.x} 
              y={img.y}
            />
          ))}
          {pins.map((pin) => (
            <PinComponent
              key={pin.id}
              pin={pin}
              scale={scale}
              isSelected={pin.id === selectedPinId}
              onSelect={(id) => onSelectPin(id)}
              onUpdate={onUpdatePin}
              onDoubleClick={onDoubleClickPin}
              onDragMove={(id, x, y, isCtrlPressed) => handlePinDragMove(id, x, y, isCtrlPressed)}
              onDragEnd={handlePinDragEnd}
            />
          ))}
          {/* Alignment Guides */}
          {guides.gaps.map((g, i) => (
             <Rect
                key={`gap-r-${i}`}
                x={g.x}
                y={g.y}
                width={g.width}
                height={(pins.find(p => p.id === selectedPinId)?.labelHeight || 26) / scale}
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
        </Layer>
      </Stage>
      <div className='absolute bottom-2 right-2 pointer-events-none text-gray-500 text-xs bg-white/80 p-1 rounded shadow'>
        Scale: {scale.toFixed(2)}x
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
