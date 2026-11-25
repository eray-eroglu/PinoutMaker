import { memo, useRef, useState } from 'react';
import { Label, Tag, Text, Circle, Line, Group } from 'react-konva';
import Konva from 'konva';
import type { PinData } from '../types';
import { calculateManhattanPath, calculateWavePoints } from '../utils/lineUtils';
import { isLightColor } from '../utils/colorUtils';
import {
  LABEL_FONT_FAMILY,
  LABEL_FONT_SIZE,
  LABEL_FONT_STYLE,
  LABEL_PADDING,
  layoutPinLabels,
} from '../utils/pinLayout';
import { measureLabelText } from '../utils/labelMeasure';

interface PinComponentProps {
  pin: PinData;
  /** World size of one label unit (project-wide). Labels, anchor and leader line scale with it. */
  labelScale: number;
  /** World gap between the labels of the row. */
  gapSize: number;
  isSelected: boolean;
  /**
   * Index into pin.functions of the label the user picked, -1 for the primary label, null when
   * no label is picked (pin not selected, or one of several selected pins).
   */
  selectedFunctionIndex: number | null;
  onSelect: (
    id: string,
    functionIndex: number,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (pin: PinData, saveHistory?: boolean) => void;
  /** withAnchor: Alt is held, so the whole pin (label and anchor) moves. Returns the snapped position. */
  onDragMove?: (id: string, x: number, y: number, isCtrlPressed: boolean, withAnchor: boolean) => { x: number, y: number } | void;
  onDragEnd?: () => void;
  /** The label row was dropped `dx/dy` world units from its stored position. */
  onRowDragEnd: (id: string, dx: number, dy: number, withAnchor: boolean) => void;
  /**
   * Set while another selected pin is being dragged: this pin follows it by the same offset
   * (label only, or the whole pin with withAnchor).
   */
  followOffset?: { dx: number; dy: number; withAnchor: boolean } | null;
  onDoubleClick: (id: string, functionIndex: number) => void;
  anchorSize: number;
  /** Dragging the label moves the anchor too, without Alt (multi-select option). */
  anchorFollowsLabel?: boolean;
}

type Point = { x: number; y: number };

// Shared, so react-konva sees an unchanged prop instead of a new object on every render
const LABEL_SHADOW_OFFSET = { x: 2, y: 2 };

/**
 * Position shown while dragging, overriding the stored one. It is never cleared on drop:
 * react-konva re-renders state changes synchronously, so clearing it would snap the node back
 * to the old stored position before the parent's update arrives (and Konva would report that
 * stale position). Instead it is dropped as soon as the stored position changes.
 */
const useDragOverride = (stored: Point) => {
  const [override, setOverride] = useState<Point | null>(null);
  const [seen, setSeen] = useState(stored);
  if (seen.x !== stored.x || seen.y !== stored.y) {
    // Adjusting state during render (React's pattern for reacting to a prop change)
    setSeen(stored);
    setOverride(null);
  }
  return [override ?? stored, setOverride] as const;
};

/** Memoized: with hundreds of labels, re-rendering only the pins that changed keeps editing smooth. */
export const PinComponent = memo(function PinComponent({
  pin,
  labelScale,
  gapSize,
  isSelected,
  selectedFunctionIndex,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
  onRowDragEnd,
  followOffset,
  onDoubleClick,
  anchorSize,
  anchorFollowsLabel = false,
}: PinComponentProps) {
  const lastClickRef = useRef({ time: 0, functionIndex: -1 });

  // Live positions while dragging. Rendering from them (instead of letting Konva move nodes
  // on its own) keeps the leader line attached and lets the row flip sides the moment the
  // label crosses its anchor.
  const [draggedLabel, setLabelDrag] = useDragOverride({ x: pin.x, y: pin.y });
  const [draggedAnchor, setAnchorDrag] = useDragOverride({ x: pin.targetX, y: pin.targetY });
  // Alt held (or anchorFollowsLabel) during the current label drag: the anchor travels with the label
  const [dragWithAnchor, setDragWithAnchor] = useState(false);

  let label = draggedLabel;
  let anchor = draggedAnchor;
  if (followOffset) {
    label = { x: pin.x + followOffset.dx, y: pin.y + followOffset.dy };
    if (followOffset.withAnchor) anchor = { x: pin.targetX + followOffset.dx, y: pin.targetY + followOffset.dy };
  } else if (dragWithAnchor) {
    anchor = { x: pin.targetX + label.x - pin.x, y: pin.targetY + label.y - pin.y };
  }
  const layout = layoutPinLabels(
    { ...pin, ...label, targetX: anchor.x },
    labelScale,
    gapSize,
    measureLabelText,
  );

  const primary = layout.labels[0];
  let leaderPoints = calculateManhattanPath(
    primary.x + primary.width / 2,
    primary.y + primary.height / 2,
    anchor.x,
    anchor.y,
  );
  if (pin.isPwm) {
    // The wave helper sizes the wave as 1/scale; pass 1/labelScale so it scales with the label
    leaderPoints = calculateWavePoints(leaderPoints, 1 / labelScale);
  }

  const handleRowDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let pos = { x: node.x(), y: node.y() };
    const withAnchor = e.evt.altKey || anchorFollowsLabel;
    setDragWithAnchor(withAnchor);
    if (onDragMove) {
      const snapped = onDragMove(pin.id, pos.x, pos.y, e.evt.ctrlKey || e.evt.metaKey, withAnchor);
      if (snapped) {
        node.position(snapped);
        pos = snapped;
      }
    }
    setLabelDrag(pos);
  };

  const handleRowDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const x = e.target.x();
    const y = e.target.y();
    if (onDragEnd) onDragEnd(); // Clear guides
    setDragWithAnchor(false);
    // The primary label position is all that is stored; the rest of the row follows it.
    // The parent applies the offset (to every selected pin when this one is part of a selection).
    onRowDragEnd(pin.id, x - pin.x, y - pin.y, dragWithAnchor);
  };

  const handleAnchorDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // The label moves with its anchor
    const dx = e.target.x() - pin.targetX;
    const dy = e.target.y() - pin.targetY;
    onUpdate({
      ...pin,
      targetX: pin.targetX + dx,
      targetY: pin.targetY + dy,
      x: pin.x + dx,
      y: pin.y + dy,
    }, true);
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, functionIndex: number) => {
    e.cancelBubble = true;

    // Shift/Ctrl+click toggles selection; two quick toggles are not a double click
    if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) {
      lastClickRef.current = { time: 0, functionIndex: -1 };
      onSelect(pin.id, functionIndex, e);
      return;
    }

    // Manual double click detection; both clicks must hit the same label
    const now = Date.now();
    const last = lastClickRef.current;
    if (now - last.time < 300 && last.functionIndex === functionIndex) {
      onDoubleClick(pin.id, functionIndex);
      lastClickRef.current = { time: 0, functionIndex: -1 };
    } else {
      lastClickRef.current = { time: now, functionIndex };
      onSelect(pin.id, functionIndex, e);
    }
  };

  const entries = [
    { key: 'primary', text: pin.text, color: pin.color, textColor: pin.textColor },
    ...(pin.functions ?? []).map(fn => ({ key: fn.id, text: fn.text, color: fn.color, textColor: fn.textColor })),
  ];

  return (
    <>
      <Line
        points={leaderPoints}
        stroke={pin.color}
        strokeWidth={2 * labelScale}
        listening={false}
      />

      <Circle
        x={anchor.x}
        y={anchor.y}
        radius={Math.max(0.1, anchorSize)}
        fill={anchorSize === 0 ? 'transparent' : pin.color}
        draggable
        scaleX={labelScale}
        scaleY={labelScale}
        onDragMove={(e) => setAnchorDrag({ x: e.target.x(), y: e.target.y() })}
        onDragEnd={handleAnchorDragEnd}
        onClick={(e) => handleSelect(e, -1)}
        onTap={(e) => handleSelect(e, -1)}
        stroke={isSelected && anchorSize > 0 ? '#333' : undefined}
        strokeWidth={isSelected && anchorSize > 0 ? 2 : 0}
        strokeScaleEnabled={false}
        hitStrokeWidth={15}
      />

      {/* The row is one draggable group positioned at the primary label, so grabbing any label moves them all */}
      <Group
        x={label.x}
        y={label.y}
        draggable
        onDragMove={handleRowDragMove}
        onDragEnd={handleRowDragEnd}
      >
        {layout.labels.map((rect, i) => {
          const entry = entries[i];
          const functionIndex = i - 1;
          const isFocused = isSelected && functionIndex === selectedFunctionIndex && (pin.functions?.length ?? 0) > 0;
          return (
            <Label
              key={entry.key}
              x={rect.x - label.x}
              y={rect.y - label.y}
              scaleX={labelScale}
              scaleY={labelScale}
              onClick={(e) => handleSelect(e, functionIndex)}
              onTap={(e) => handleSelect(e, functionIndex)}
            >
              <Tag
                fill={entry.color}
                cornerRadius={4}
                shadowColor='black'
                shadowBlur={2}
                shadowOpacity={0.2}
                shadowOffset={LABEL_SHADOW_OFFSET}
                // The outline is the selection mark: a large blurred shadow on hundreds of
                // selected labels made every redraw slow. Its shadow would only be drawn twice.
                shadowForStrokeEnabled={false}
                // The label the user picked (for the sidebar) gets a blue outline
                stroke={isFocused ? '#2563eb' : isSelected ? '#111827' : undefined}
                strokeWidth={isFocused ? 2.5 : isSelected ? 2 : 0}
                strokeScaleEnabled={false}
              />
              <Text
                text={entry.text}
                fill={entry.textColor || (isLightColor(entry.color) ? 'black' : 'white')}
                padding={LABEL_PADDING}
                fontFamily={LABEL_FONT_FAMILY}
                fontSize={LABEL_FONT_SIZE}
                fontStyle={LABEL_FONT_STYLE}
                // Fixed layout width keeps the columns aligned; never wrap if measurement is a pixel off
                width={rect.width / labelScale}
                wrap='none'
                align='center'
              />
            </Label>
          );
        })}
      </Group>
    </>
  );
});
