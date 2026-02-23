import { useEffect, forwardRef, useState  } from 'react';
import { Stage, Layer, Line, Image as KonvaImage  } from 'react-konva';
import Konva from 'konva';
import type { PinData } from '../types';
import { PinComponent } from './PinComponent';

interface CanvasStageProps {
  image: HTMLImageElement | null;
  imageRotation: number;
  pins: PinData[];
  selectedPinId: string | null;
  onSelectPin: (id: string | null) => void;
  onUpdatePin: (pin: PinData) => void;
  isAddingPin?: boolean;
  onCreatePin?: (x: number, y: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
}

export const CanvasStage = forwardRef<Konva.Stage, CanvasStageProps>(({
  image,
  imageRotation,
  pins,
  selectedPinId,
  onSelectPin,
  onUpdatePin,
  isAddingPin = false,
  onCreatePin,
  scale,
  setScale,
  position,
  setPosition,
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

  // Center image when it loads or rotates
  useEffect(() => {
    if (image) {
      // If rotated 90 or 270 degrees, swap width and height for centering calculation
      const isVertical = imageRotation % 180 !== 0;
      const displayWidth = isVertical ? image.height : image.width;
      const displayHeight = isVertical ? image.width : image.height;

      // Center the image in the view
      // We position the Stage such that (0,0) (which will be the center of our image) is at the center of the viewport
      const x = (width - displayWidth) / 2;
      const y = (height - displayHeight) / 2;

      // When rotating, we must offset the image position so it rotates around its center
      // But we will handle that in the <KonvaImage> props directly by setting x/y to center and offsetting
      
      // Reset visual transform to focus on the image only on load (rotation shouldn't reset scale maybe?)
      // For now, let's reset to keep it simple as requested "resim ... dik yapıcaz"
      setScale(1);
      setPosition({ x: x + displayWidth / 2, y: y + displayHeight / 2 }); // Shift stage to look at the center
      // Actually, if we set image x=0, y=0 to be TopLeft, rotation is hard.
      // Let's set Image x=0, y=0 to be CENTER of image.
    }
  }, [image, imageRotation]); // Removed width and height from dependencies

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
      // Deselect if clicking on empty space (Stage, Grid, Image)
      // Note: PinComponent stops propagation, so this won't fire when clicking a Pin.
      onSelectPin(null);
    }
  };

  // Alignment Guides
  const [guides, setGuides] = useState<{ vertical: number[], horizontal: number[] }>({ vertical: [], horizontal: [] });

  const handlePinDragMove = (id: string, x: number, y: number) => {
    // Find nearby alignments
    const THRESHOLD = 10 / scale; // Snap within 10 screen pixels
    
    // We need to know the dimensions of the pins to calculate gaps between EDGES.
    // However, PinData only stores x,y (top-left).
    // Let's assume a standard size or measure it.
    // In PinComponent, the rect is rendered. We don't have exact width in State easily.
    // But aligning the "top-left" points (origin) equidistantly is usually what people mean 
    // when they say "equal spacing" in these simple tools, unless the boxes vary wildly in size.
    // Let's stick to "Origin to Origin" distance for now, which is "Top-Left to Top-Left".
    
    const verticalGuides: number[] = [];
    const horizontalGuides: number[] = [];
    
    let snappedX = x;
    let snappedY = y;

    // 1. Standard Alignment (Snap to common existing X or Y)
    pins.forEach(otherPin => {
        if (otherPin.id === id) return;
        
        // Horizontal Alignment (y matches)
        if (Math.abs(otherPin.y - y) < THRESHOLD) {
            horizontalGuides.push(otherPin.y);
            snappedY = otherPin.y; 
        }

        // Vertical Alignment (x matches)
        if (Math.abs(otherPin.x - x) < THRESHOLD) {
            verticalGuides.push(otherPin.x);
            snappedX = otherPin.x;
        }
    });

    setGuides({ vertical: verticalGuides, horizontal: horizontalGuides });
    
    // Return snapped position
    return { x: snappedX, y: snappedY };
  };

  const handlePinDragEnd = () => {
      setGuides({ vertical: [], horizontal: [] });
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
          {image && (
            <KonvaImage
              image={image}
              rotation={imageRotation}
              // Set the origin to the center of the image
              offsetX={image.width / 2}
              offsetY={image.height / 2}
              x={0} 
              y={0}
            />
          )}
          {pins.map((pin) => (
            <PinComponent
              key={pin.id}
              pin={pin}
              scale={scale}
              isSelected={pin.id === selectedPinId}
              onSelect={(id) => onSelectPin(id)}
              onUpdate={onUpdatePin}
              onDragMove={(id, x, y) => handlePinDragMove(id, x, y)}
              onDragEnd={handlePinDragEnd}
            />
          ))}
          {/* Alignment Guides */}
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
    </div>
  );
});
