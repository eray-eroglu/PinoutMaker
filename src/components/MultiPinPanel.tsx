import { useState } from 'react';
import { AlignEndVertical, AlignStartHorizontal, AlignVerticalDistributeCenter, Combine, Rows3, Trash2 } from 'lucide-react';
import type { PinData } from '../types';
import { ColorPalette } from './Sidebar';
import { defineMessages, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    pinsSelected: (n: number) => `${n} pins selected`,
    selectionHelp: 'Shift/Ctrl+click toggles a pin, Shift+drag selects an area. Dragging a selected label or the arrow keys move them all.',
    moveAnchors: 'Move anchors too',
    moveAnchorsOn: 'Whole pins move together.',
    moveAnchorsOff: 'Only the labels move; hold Alt to move the anchors as well.',
    align: 'Align',
    alignEdges: 'Align label edges to anchor',
    alignEdgesTitle: 'Left of the anchor: align right edges. Right of it: align left edges. Each side separately.',
    alignTops: 'Align label tops',
    alignTopsTitle: 'Move all labels to the y of the topmost one',
    distribute: 'Distribute vertically',
    distributeTitle: 'Equal spacing between the topmost and bottommost label (per side)',
    rowSpacing: 'Row spacing',
    apply: 'Apply',
    applyTitle: 'Distance from one label top to the next (board px), applied top to bottom from the topmost label',
    labelColourAll: 'Label colour (all)',
    pwmAll: 'PWM Capable (all)',
    combine: 'Combine into one row',
    combineRows: (n: number) => ` (${n} rows)`,
    combineTitle: 'The label closest to its anchor stays; the others in its row become its function labels',
    combineHelp: 'For projects where every function is a separate pin: labels on the same side and row become one pin with functions.',
    deletePins: (n: number) => `Delete ${n} pins`,
  },
  tr: {
    pinsSelected: (n: number) => `${n} pin seçili`,
    selectionHelp: 'Shift/Ctrl+tık bir pini seçime ekler/çıkarır, Shift+sürükle bir alanı seçer. Seçili bir etiketi sürüklemek veya Ok tuşları hepsini taşır.',
    moveAnchors: 'Bağlantı noktalarını da taşı',
    moveAnchorsOn: 'Pinler bütün olarak birlikte taşınır.',
    moveAnchorsOff: 'Yalnızca etiketler taşınır; bağlantı noktalarını da taşımak için Alt tuşunu basılı tutun.',
    align: 'Hizala',
    alignEdges: 'Etiket kenarlarını bağlantı noktasına hizala',
    alignEdgesTitle: 'Bağlantı noktasının solundakiler: sağ kenarlar hizalanır. Sağındakiler: sol kenarlar hizalanır. Her taraf ayrı ayrı.',
    alignTops: 'Etiket üstlerini hizala',
    alignTopsTitle: 'Tüm etiketleri en üstteki etiketin y konumuna taşı',
    distribute: 'Dikey olarak dağıt',
    distributeTitle: 'En üstteki ve en alttaki etiket arasında eşit boşluk (her taraf için)',
    rowSpacing: 'Satır aralığı',
    apply: 'Uygula',
    applyTitle: 'Bir etiketin üstünden sonrakinin üstüne olan mesafe (kart pikseli), en üstteki etiketten başlayarak yukarıdan aşağıya uygulanır',
    labelColourAll: 'Etiket rengi (tümü)',
    pwmAll: 'PWM destekli (tümü)',
    combine: 'Tek satırda birleştir',
    combineRows: (n: number) => ` (${n} satır)`,
    combineTitle: 'Bağlantı noktasına en yakın etiket kalır; satırdaki diğerleri onun fonksiyon etiketleri olur',
    combineHelp: 'Her fonksiyonun ayrı bir pin olduğu projeler için: aynı taraf ve satırdaki etiketler, fonksiyonları olan tek bir pine dönüşür.',
    deletePins: (n: number) => `${n} pini sil`,
  },
});

interface MultiPinPanelProps {
  /** The selected pins (two or more). */
  pins: PinData[];
  /** Current average top-to-top distance of the rows, used as the spacing field's start value. */
  rowPitch: number | null;
  /** Rows of two or more separate pins that "Combine into one row" would merge. */
  combinableRows: number;
  /** Dragging or nudging the selection moves the anchors with the labels. */
  moveAnchors: boolean;
  onMoveAnchorsChange: (moveAnchors: boolean) => void;
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

const BUTTON = 'flex items-center gap-2 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 py-1.5 px-2 rounded text-xs font-medium text-left disabled:opacity-40 disabled:hover:bg-gray-200 dark:disabled:hover:bg-gray-700';

/** Sidebar panel for bulk edits while several pins are selected. Every action is one undo step. */
export const MultiPinPanel = ({
  pins, rowPitch, combinableRows, moveAnchors, onMoveAnchorsChange,
  onAlignEdges, onAlignTops, onDistribute, onApplyRowPitch, onSetColor, onSetPwm, onDelete, onCombineRows,
}: MultiPinPanelProps) => {
  const t = useMessages(MESSAGES);
  // Kept as text so the field can be cleared while typing
  const [pitch, setPitch] = useState(() => String(rowPitch === null ? 20 : Math.round(rowPitch * 10) / 10));
  const pitchValue = pitch.trim() === '' ? NaN : Number(pitch);

  const colors = new Set(pins.map(p => p.color));
  const commonColor = colors.size === 1 ? pins[0].color : null;
  const pwmCount = pins.filter(p => p.isPwm).length;

  return (
    <div className='space-y-4'>
      <div>
        <div className='text-sm font-semibold text-gray-700 dark:text-gray-200'>{t.pinsSelected(pins.length)}</div>
        <p className='text-[10px] text-gray-400 dark:text-gray-500 mt-0.5'>
          {t.selectionHelp}
        </p>
      </div>

      <label className='flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer'>
        <input
          type='checkbox'
          className='mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500'
          checked={moveAnchors}
          onChange={e => onMoveAnchorsChange(e.target.checked)}
        />
        <span>
          {t.moveAnchors}
          <span className='block text-[10px] text-gray-400 dark:text-gray-500'>
            {moveAnchors ? t.moveAnchorsOn : t.moveAnchorsOff}
          </span>
        </span>
      </label>

      <div className='space-y-1.5'>
        <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase'>{t.align}</div>
        <button type='button' className={BUTTON} onClick={onAlignEdges} title={t.alignEdgesTitle}>
          <AlignEndVertical size={14} /> {t.alignEdges}
        </button>
        <button type='button' className={BUTTON} onClick={onAlignTops} title={t.alignTopsTitle}>
          <AlignStartHorizontal size={14} /> {t.alignTops}
        </button>
        <button type='button' className={BUTTON} onClick={onDistribute} title={t.distributeTitle}>
          <AlignVerticalDistributeCenter size={14} /> {t.distribute}
        </button>
        <div className='flex items-center gap-2'>
          <Rows3 size={14} className='text-gray-500 dark:text-gray-400 shrink-0' />
          <label htmlFor='multi-row-pitch' className='text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap'>{t.rowSpacing}</label>
          <input
            id='multi-row-pitch'
            type='number'
            min='0'
            step='0.5'
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            className='w-16 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-xs outline-none focus:border-blue-500'
          />
          <button
            type='button'
            disabled={!(pitchValue >= 0)}
            onClick={() => onApplyRowPitch(pitchValue)}
            className='bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 py-1 px-2 rounded text-xs font-medium disabled:opacity-40'
            title={t.applyTitle}
          >
            {t.apply}
          </button>
        </div>
      </div>

      <div>
        <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2'>{t.labelColourAll}</div>
        <ColorPalette value={commonColor} onChange={onSetColor} />
      </div>

      <label className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer'>
        <input
          type='checkbox'
          className='rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500'
          checked={pwmCount === pins.length}
          // Mixed selection: show the "some" state; clicking makes them all PWM
          ref={el => { if (el) el.indeterminate = pwmCount > 0 && pwmCount < pins.length; }}
          onChange={e => onSetPwm(e.target.checked)}
        />
        {t.pwmAll}
      </label>

      <div className='space-y-1'>
        <button
          type='button'
          className={BUTTON}
          onClick={onCombineRows}
          disabled={combinableRows === 0}
          title={t.combineTitle}
        >
          <Combine size={14} /> {t.combine}{combinableRows > 1 ? t.combineRows(combinableRows) : ''}
        </button>
        <p className='text-[10px] text-gray-400 dark:text-gray-500'>
          {t.combineHelp}
        </p>
      </div>

      <button
        type='button'
        onClick={onDelete}
        className='flex items-center justify-center gap-2 w-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-950/70 dark:text-red-400 py-1.5 px-2 rounded text-xs font-medium border border-red-200 dark:border-red-800'
      >
        <Trash2 size={14} /> {t.deletePins(pins.length)}
      </button>
    </div>
  );
};
