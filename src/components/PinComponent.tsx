import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { Label, Tag, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { PinData } from '../types';
import { calculateManhattanPath, calculateWavePoints } from '../utils/lineUtils';

interface PinComponentProps {
  pin: PinData;
  scale: number;
  isSelected: boolean;
  onSelect: (
    id: string,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (pin: PinData, saveHistory?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number, isCtrlPressed: boolean) => { x: number, y: number } | void;
  onDragEnd?: () => void;
  onDoubleClick: (id: string, currentText: string) => void;
}

export const PinComponent: React.FC<PinComponentProps> = ({
  pin,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
  onDoubleClick,
}) => {
  const labelRef = useRef<Konva.Label>(null);
  const anchorRef = useRef<Konva.Circle>(null);
  const lineRef = useRef<Konva.Line>(null);
  const lastClickTimeRef = useRef(0);

  const invScale = 1 / scale;

  // AUTO-MIGRATION & WIDTH CALCULATION:
  // If pin lacks labelDx/labelDy, calculate them now based on current x,y and scale.
  // Also save the rendered width/height so CanvasStage can use it for right-edge alignment.
  useEffect(() => {
    let needsUpdate = false;
    const updates: Partial<PinData> = {};

    if (pin.labelDx === undefined || pin.labelDy === undefined) {
      updates.labelDx = (pin.x - pin.targetX) * scale;
      updates.labelDy = (pin.y - pin.targetY) * scale;
      needsUpdate = true;
    }

    if (labelRef.current) {
      const w = labelRef.current.width();
      const h = labelRef.current.height();
      if (pin.labelWidth !== w || pin.labelHeight !== h) {
        updates.labelWidth = w;
        updates.labelHeight = h;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      onUpdate({ ...pin, ...updates }, false);
    }
  }, [pin.text]); // Run on mount and when text changes

  // Calculate position: Prefer visual offset (dx/dy), fallback to legacy x,y
  const hasOffset = pin.labelDx !== undefined && pin.labelDy !== undefined;
  
  const currentLabelX = hasOffset 
    ? pin.targetX + (pin.labelDx! / scale) 
    : pin.x;
    
  const currentLabelY = hasOffset 
    ? pin.targetY + (pin.labelDy! / scale) 
    : pin.y;

  const updateLine = React.useCallback(() => {
    if (labelRef.current && anchorRef.current && lineRef.current) {
      const labelNode = labelRef.current;
      const anchorNode = anchorRef.current;
      
      const width = labelNode.width();
      const height = labelNode.height();

      const labelX = labelNode.x();
      const labelY = labelNode.y();

      const centerX = labelX + (width * labelNode.scaleX()) / 2;
      const centerY = labelY + (height * labelNode.scaleY()) / 2;

      const anchorPos = anchorNode.position();

      // Noktaları ref üzerinden veriyoruz
      const x1 = centerX;
      const y1 = centerY;
      const x2 = anchorPos.x;
      const y2 = anchorPos.y;

      let points = calculateManhattanPath(x1, y1, x2, y2);

      // PWM Dalga Efekti
      if (pin.isPwm) {
        points = calculateWavePoints(points, scale);
      }
      
      lineRef.current.points(points);
      
      // EKRANI ZORLA YENİLE (Titremeyi ve geri atmayı engeller)
      lineRef.current.getLayer()?.batchDraw(); 
    }
  }, [pin.isPwm, scale]); // Note: We read positions from refs directly (labelNode.x()) which is updated by Konva during drag.
                          // However, for initial render or props change, we need to trigger it.

  useLayoutEffect(() => {
    updateLine();
  }, [currentLabelX, currentLabelY, pin.targetX, pin.targetY, pin.text, scale, pin.isPwm, updateLine]);


  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Notify parent about new position during drag
    let snappedPos = { x: 0, y: 0};
    if (labelRef.current) {
        snappedPos.x = labelRef.current.x();
        snappedPos.y = labelRef.current.y();
        
        if (onDragMove) {
            const isCtrlPressed = e.evt.ctrlKey || e.evt.metaKey;
            const result = onDragMove(pin.id, snappedPos.x, snappedPos.y, isCtrlPressed);
            if (result && (result.x !== snappedPos.x || result.y !== snappedPos.y)) {
                // If snap occurred, update position immediately
                labelRef.current.position({ x: result.x, y: result.y });
                snappedPos = result;
            }
        }
    }
    
    updateLine();
  };

  const handleLabelDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y();
    
    if (onDragEnd) onDragEnd(); // Clear guides
    
    // Calculate new visual offset based on drop position
    const newDx = (newX - pin.targetX) * scale;
    const newDy = (newY - pin.targetY) * scale;

    // Save the rendered width and height so CanvasStage can use it for right-edge alignment
    const width = labelRef.current?.width() || 0;
    const height = labelRef.current?.height() || 0;

    onUpdate({
      ...pin,
      x: newX, // Keep legacy synced just in case
      y: newY,
      labelDx: newDx,
      labelDy: newDy,
      labelWidth: width,
      labelHeight: height
    }, true);
  };

  const handleAnchorDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newTargetX = e.target.x();
    const newTargetY = e.target.y();
    
    // When anchor moves, update everything
    const newLabelX = newTargetX + (pin.labelDx ?? 0) / scale;
    const newLabelY = newTargetY + (pin.labelDy ?? 0) / scale;

    onUpdate({
      ...pin,
      targetX: newTargetX,
      targetY: newTargetY,
      x: newLabelX,
      y: newLabelY
    }, true);
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    
    // Manual double click detection
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    if (timeDiff < 300) {
      onDoubleClick(pin.id, pin.text);
      lastClickTimeRef.current = 0; // Reset
    } else {
      lastClickTimeRef.current = currentTime;
      onSelect(pin.id, e);
    }
  };
  
  // Keep handleDoubleClick just in case, but removing from JSX usage or keep it as backup?
  // Ideally manual detection in handleSelect covers it.
  // Actually, let's remove the separate handleDoubleClick and the onDblClick props to avoid double firing.


  return (
    <>
      <Line
        ref={lineRef}
        // Points are set via ref in updateLine
        stroke={pin.color}
        strokeWidth={2}
        strokeScaleEnabled={false}
        listening={false}
      />

      <Circle
        ref={anchorRef}
        x={pin.targetX}
        y={pin.targetY}
        radius={5}
        fill={pin.color}
        draggable
        scaleX={invScale}
        scaleY={invScale}
        onDragMove={updateLine}
        onDragEnd={handleAnchorDragEnd}
        onClick={handleSelect}
        onTap={handleSelect}
        stroke={isSelected ? '#333' : undefined}
        strokeWidth={isSelected ? 2 : 0}
        strokeScaleEnabled={false}
        hitStrokeWidth={15}
      />

      <Label
        ref={labelRef}
        x={currentLabelX}
        y={currentLabelY}
        draggable
        scaleX={invScale}
        scaleY={invScale}
        onDragMove={handleDragMove}
        onDragEnd={handleLabelDragEnd}
        onClick={handleSelect}
        onTap={handleSelect}
      >
        <Tag
          fill={pin.color}
          cornerRadius={4}
          shadowColor='black'
          shadowBlur={isSelected ? 10 : 2}
          shadowOpacity={0.2}
          shadowOffset={{ x: 2, y: 2 }}
          stroke={isSelected ? '#333' : undefined}
          strokeWidth={isSelected ? 1.5 : 0}
          strokeScaleEnabled={false}
          listening={true}
          onClick={handleSelect}
          onTap={handleSelect}
        />
        <Text
          text={pin.text}
          onClick={handleSelect}
          onTap={handleSelect}
          fill={
            ['#FFD700', '#00FFFF', '#7FFFD4', '#F0F0F0', '#FFFFFF'].includes(pin.color)
              ? 'black'
              : 'white'
          }
          padding={6}
          fontFamily='Inter, sans-serif'
          fontSize={12}
          fontStyle='600'
          width={pin.text.length <= 6 ? 60 : undefined} 
          align='center' 
          listening={true}
        />
      </Label>
    </>
  );
};