import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { Label, Tag, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { PinData } from '../types';

interface PinComponentProps {
  pin: PinData;
  scale: number;
  isSelected: boolean;
  onSelect: (
    id: string,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (pin: PinData) => void;
  onDragMove?: (id: string, x: number, y: number) => { x: number, y: number } | void;
  onDragEnd?: () => void;
}

export const PinComponent: React.FC<PinComponentProps> = ({
  pin,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
}) => {
  const labelRef = useRef<Konva.Label>(null);
  const anchorRef = useRef<Konva.Circle>(null);
  const lineRef = useRef<Konva.Line>(null);

  const invScale = 1 / scale;

  // AUTO-MIGRATION:
  // If pin lacks labelDx/labelDy, calculate them now based on current x,y and scale.
  // This "freezes" existing pins to their current visual distance.
  useEffect(() => {
    if (pin.labelDx === undefined || pin.labelDy === undefined) {
      const dx = (pin.x - pin.targetX) * scale;
      const dy = (pin.y - pin.targetY) * scale;
      onUpdate({ ...pin, labelDx: dx, labelDy: dy });
    }
  }, []); // Run once on mount

  // Calculate position: Prefer visual offset (dx/dy), fallback to legacy x,y
  const hasOffset = pin.labelDx !== undefined && pin.labelDy !== undefined;
  
  const currentLabelX = hasOffset 
    ? pin.targetX + (pin.labelDx! / scale) 
    : pin.x;
    
  const currentLabelY = hasOffset 
    ? pin.targetY + (pin.labelDy! / scale) 
    : pin.y;

  const updateLine = () => {
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

      // Basit L-Şekli (Manhattan Routing) Algoritması
      // Etiketin konumuna göre en mantıklı köşeli yolu buluruz.
      let points: number[] = [];

      const dx = x2 - x1;
      const dy = y2 - y1;
      
      // Manhattan Logic:
      // Eğer yatay mesafe daha büyükse, önce YATAY git sonra DİKEY.
      // Eyer dikey mesafe daha büyükse, önce DİKEY git sonra YATAY.
      if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal Dominant: (x1,y1) -> (x2, y1) -> (x2, y2)
          points = [x1, y1, x2, y1, x2, y2];
      } else {
          // Vertical Dominant: (x1,y1) -> (x1, y2) -> (x2, y2)
          points = [x1, y1, x1, y2, x2, y2];
      }

      // PWM Dalga Efekti
      if (pin.isPwm) {
        const wavePoints: number[] = [];
        
        // points dizisi [x1, y1, mx, my, x2, y2] şeklindedir (3 nokta, 2 segment).
        // Segmentleri tek tek işleyip dalgalandıracağız.
        for (let i = 0; i < points.length - 2; i += 2) {
            const sx = points[i];
            const sy = points[i+1];
            const ex = points[i+2];
            const ey = points[i+3];
            
            const segDx = ex - sx;
            const segDy = ey - sy;
            const dist = Math.sqrt(segDx*segDx + segDy*segDy);
            
            // Çok kısa segmentleri atla veya düz çiz
            if (dist < 1) { 
                continue; 
            }

            const nx = segDx / dist;
            const ny = segDy / dist;
            const px = -ny;
            const py = nx;
            
            const desiredWaveLength = 10; 
            const cycleCount = Math.max(1, Math.round(dist / (desiredWaveLength / scale)));
            const waveLength = dist / cycleCount;
            const amplitude = 3 / scale;
            
            // Eğer segment çok kısaysa dalga yapma
            if (dist < (15 / scale)) {
                 wavePoints.push(sx, sy);
                 wavePoints.push(ex, ey);
                 continue;
            }

            const step = Math.max(1 / scale, dist / (cycleCount * 8));
            
            // Segment başlangıcı
            if (i === 0) wavePoints.push(sx, sy);
            
            for (let d = 0; d <= dist; d += step) {
                 const waveOffset = amplitude * Math.sin((d / waveLength) * Math.PI * 2);
                 const wx = sx + nx * d + px * waveOffset;
                 const wy = sy + ny * d + py * waveOffset;
                 wavePoints.push(wx, wy);
            }
            // Segment bitişinden emin ol
             wavePoints.push(ex, ey);
        }
        
        lineRef.current.points(wavePoints);
      } else {
          // Düz L-Çizgisi
          lineRef.current.points(points);
      }
      
      // EKRANI ZORLA YENİLE (Titremeyi ve geri atmayı engeller)
      lineRef.current.getLayer()?.batchDraw(); 
    }
  };

  useLayoutEffect(() => {
    updateLine();
  }, [currentLabelX, currentLabelY, pin.targetX, pin.targetY, pin.text, scale, pin.isPwm]);

  const handleDragMove = () => {
    // Notify parent about new position during drag
    let snappedPos = { x: 0, y: 0};
    if (labelRef.current) {
        snappedPos.x = labelRef.current.x();
        snappedPos.y = labelRef.current.y();
        
        if (onDragMove) {
            const result = onDragMove(pin.id, snappedPos.x, snappedPos.y);
            if (result) {
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

    onUpdate({
      ...pin,
      x: newX, // Keep legacy synced just in case
      y: newY,
      labelDx: newDx,
      labelDy: newDy
    });
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
    });
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onSelect(pin.id, e);
  };

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
        // Use dragBoundFunc for robust snapping (prevents jitter) - optional improvement
        // but handleDragMove is easier to implement for now.
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
        />
        <Text
          text={pin.text}
          fill={
            ['#FFD700', '#00FFFF', '#7FFFD4', '#F0F0F0', '#FFFFFF'].includes(pin.color)
              ? 'black'
              : 'white'
          }
          padding={6}
          fontFamily='Inter, sans-serif'
          fontSize={12}
          fontStyle='600'
          // ---- EKLENEN / DEĞİŞTİRİLEN KISIM BAŞLANGICI ----
          
          // Eğer metin 6 karakter veya daha kısaysa (GND, 3V3, GPIO15 vs.) 
          // kutunun iç genişliğini standart 55 piksel yap. Uzunsa otomatik bırak.
          width={pin.text.length <= 6 ? 55 : undefined} 
          
          // Metni bu 55 piksellik alanın tam ortasına hizala
          align='center' 
          
          // ---- EKLENEN KISIM BİTİŞİ ----
        />
      </Label>
    </>
  );
};