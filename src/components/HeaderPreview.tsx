import { Circle, Group, Line } from 'react-konva';
import type { PinData } from '../types';
import type { Point } from '../utils/header';
import { PinComponent } from './PinComponent';

interface HeaderPreviewProps {
  start: Point;
  end: Point;
  /** Where the pins will go (already spread from start to end). */
  anchors: Point[];
  /** Zoom; the guide line and dots are screen-sized UI, not part of the drawing. */
  scale: number;
  /** Once both pads are picked: the pins that Create would add, drawn as a faded ghost. */
  ghostPins?: PinData[];
  labelScale: number;
  gapSize: number;
  anchorSize: number;
}

const noop = () => {};

/** Live preview of the header tool: the picked span, one dot per pin and, later, the labels. */
export const HeaderPreview = ({ start, end, anchors, scale, ghostPins, labelScale, gapSize, anchorSize }: HeaderPreviewProps) => (
  <Group listening={false}>
    {ghostPins && (
      <Group opacity={0.55}>
        {ghostPins.map(pin => (
          <PinComponent
            key={pin.id}
            pin={pin}
            labelScale={labelScale}
            gapSize={gapSize}
            isSelected={false}
            selectedFunctionIndex={-1}
            onSelect={noop}
            onUpdate={noop}
            onDoubleClick={noop}
            onRowDragEnd={noop}
            anchorSize={anchorSize}
          />
        ))}
      </Group>
    )}
    <Line
      points={[start.x, start.y, end.x, end.y]}
      stroke='#2563eb'
      strokeWidth={1.5 / scale}
      dash={[6 / scale, 4 / scale]}
    />
    {anchors.map((a, i) => (
      <Circle key={i} x={a.x} y={a.y} radius={4 / scale} fill='#2563eb' stroke='white' strokeWidth={1 / scale} />
    ))}
  </Group>
);
