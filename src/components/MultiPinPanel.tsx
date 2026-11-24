import { useState } from 'react';
import { AlignEndVertical, AlignStartHorizontal, AlignVerticalDistributeCenter, Combine, Rows3, Trash2 } from 'lucide-react';
import type { PinData } from '../types';
import { ColorPalette } from './Sidebar';

interface MultiPinPanelProps {
  /** The selected pins (two or more). */
  pins: PinData[];
  /** Current average top-to-top distance of the rows, used as the spacing field's start value. */
  rowPitch: number | null;
  /** Rows of two or more separate pins that "Combine into one row" would merge. */
  combinableRows: number;
  onAlignEdges: () => void;
  onAlignTops: () => void;
  onDistribute: () => void;
  onApplyRowPitch: (pitch: number) => void;
  /** saveHistory is false for the live updates of a colour picker session after its first colour. */
  onSetColor: (color: string, saveHistory: boolean) => void;
  onSetPwm: (isPwm: boolean) => void;
  onDelete: () => void;
  onCombineRows: () => void;
}

const BUTTON = 'flex items-center gap-2 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-1.5 px-2 rounded text-xs font-medium text-left disabled:opacity-40 disabled:hover:bg-gray-200';

/** Sidebar panel for bulk edits while several pins are selected. Every action is one undo step. */
export const MultiPinPanel = ({
  pins, rowPitch, combinableRows,
  onAlignEdges, onAlignTops, onDistribute, onApplyRowPitch, onSetColor, onSetPwm, onDelete, onCombineRows,
}: MultiPinPanelProps) => {
  // Kept as text so the field can be cleared while typing
  const [pitch, setPitch] = useState(() => String(rowPitch === null ? 20 : Math.round(rowPitch * 10) / 10));
  const pitchValue = pitch.trim() === '' ? NaN : Number(pitch);

  const colors = new Set(pins.map(p => p.color));
  const commonColor = colors.size === 1 ? pins[0].color : null;
  const pwmCount = pins.filter(p => p.isPwm).length;

  return (
    <div className='space-y-4'>
      <div>
        <div className='text-sm font-semibold text-gray-700'>{pins.length} pins selected</div>
        <p className='text-[10px] text-gray-400 mt-0.5'>
          Shift/Ctrl+click toggles a pin, Shift+drag selects an area. Dragging a selected label moves them all (Alt: with anchors).
        </p>
      </div>

      <div className='space-y-1.5'>
        <div className='text-xs font-semibold text-gray-500 uppercase'>Align</div>
        <button type='button' className={BUTTON} onClick={onAlignEdges} title='Left of the anchor: align right edges. Right of it: align left edges. Each side separately.'>
          <AlignEndVertical size={14} /> Align label edges to anchor
        </button>
        <button type='button' className={BUTTON} onClick={onAlignTops} title='Move all labels to the y of the topmost one'>
          <AlignStartHorizontal size={14} /> Align label tops
        </button>
        <button type='button' className={BUTTON} onClick={onDistribute} title='Equal spacing between the topmost and bottommost label (per side)'>
          <AlignVerticalDistributeCenter size={14} /> Distribute vertically
        </button>
        <div className='flex items-center gap-2'>
          <Rows3 size={14} className='text-gray-500 shrink-0' />
          <label htmlFor='multi-row-pitch' className='text-xs text-gray-600 whitespace-nowrap'>Row spacing</label>
          <input
            id='multi-row-pitch'
            type='number'
            min='0'
            step='0.5'
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            className='w-16 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500'
          />
          <button
            type='button'
            disabled={!(pitchValue >= 0)}
            onClick={() => onApplyRowPitch(pitchValue)}
            className='bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded text-xs font-medium disabled:opacity-40'
            title='Distance from one label top to the next (board px), applied top to bottom from the topmost label'
          >
            Apply
          </button>
        </div>
      </div>

      <div>
        <div className='text-xs font-semibold text-gray-500 uppercase mb-2'>Label colour (all)</div>
        <ColorPalette value={commonColor} onChange={onSetColor} />
      </div>

      <label className='flex items-center gap-2 text-sm text-gray-600 cursor-pointer'>
        <input
          type='checkbox'
          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          checked={pwmCount === pins.length}
          // Mixed selection: show the "some" state; clicking makes them all PWM
          ref={el => { if (el) el.indeterminate = pwmCount > 0 && pwmCount < pins.length; }}
          onChange={e => onSetPwm(e.target.checked)}
        />
        PWM Capable (all)
      </label>

      <div className='space-y-1'>
        <button
          type='button'
          className={BUTTON}
          onClick={onCombineRows}
          disabled={combinableRows === 0}
          title='The label closest to its anchor stays; the others in its row become its function labels'
        >
          <Combine size={14} /> Combine into one row{combinableRows > 1 ? ` (${combinableRows} rows)` : ''}
        </button>
        <p className='text-[10px] text-gray-400'>
          For projects where every function is a separate pin: labels on the same side and row become one pin with functions.
        </p>
      </div>

      <button
        type='button'
        onClick={onDelete}
        className='flex items-center justify-center gap-2 w-full bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-2 rounded text-xs font-medium border border-red-200'
      >
        <Trash2 size={14} /> Delete {pins.length} pins
      </button>
    </div>
  );
};
