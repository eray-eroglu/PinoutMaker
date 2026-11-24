import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { MAX_HEADER_PINS, clampHeaderCount, headerPinName } from '../utils/header';
import type { HeaderSettings, HeaderSide, HeaderSideSetting } from '../utils/header';

interface HeaderPanelProps {
  settings: HeaderSettings;
  onChange: (settings: HeaderSettings) => void;
  /** What 'auto' currently resolves to, shown next to the option. */
  resolvedSide: HeaderSide;
  onCreate: () => void;
  onCancel: () => void;
}

const SIDES: Array<[HeaderSideSetting, string]> = [
  ['auto', 'Auto'],
  ['left', 'Left'],
  ['right', 'Right'],
  ['above', 'Above'],
  ['below', 'Below'],
];

const inputClass = 'border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500';

/** Settings for a header whose first and last pads were just picked; the canvas previews them live. */
export const HeaderPanel = ({ settings, onChange, resolvedSide, onCreate, onCancel }: HeaderPanelProps) => {
  // Number fields keep their own text so they can be cleared while typing
  const [countText, setCountText] = useState(String(settings.count));
  const countRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    countRef.current?.focus();
    countRef.current?.select();
  }, []);

  const update = (changes: Partial<HeaderSettings>) => onChange({ ...settings, ...changes });
  const numbered = settings.naming === 'numbered';
  const lastName = headerPinName(settings, settings.count - 1);

  return (
    <div
      role='dialog'
      aria-label='New header'
      className='absolute top-3 left-3 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg space-y-3'
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel();
        else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onCreate();
      }}
    >
      <div className='flex items-center gap-2 font-semibold text-gray-800'>
        <GripVertical size={16} className='text-blue-600' /> New header
      </div>

      <label className='flex items-center justify-between gap-2'>
        <span>Pins</span>
        <input
          ref={countRef}
          type='number'
          min={1}
          max={MAX_HEADER_PINS}
          value={countText}
          onChange={e => {
            setCountText(e.target.value);
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n) && n >= 1) update({ count: clampHeaderCount(n) });
          }}
          onBlur={() => setCountText(String(settings.count))}
          className={`${inputClass} w-20`}
        />
      </label>

      <fieldset className='space-y-2'>
        <legend className='mb-1'>Names</legend>
        <div className='flex rounded border border-gray-300 overflow-hidden text-xs' role='group' aria-label='Naming'>
          {([['numbered', 'Numbered'], ['blank', 'Blank']] as const).map(([naming, label]) => (
            <button
              key={naming}
              type='button'
              aria-pressed={settings.naming === naming}
              onClick={() => update({ naming })}
              className={`flex-1 px-2 py-1 border-r last:border-r-0 border-gray-300 ${settings.naming === naming ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {numbered && (
          <div className='grid grid-cols-3 gap-2 text-xs text-gray-500'>
            <label className='space-y-0.5'>
              <span>Prefix</span>
              <input
                type='text'
                value={settings.prefix}
                onChange={e => update({ prefix: e.target.value })}
                className={`${inputClass} w-full`}
              />
            </label>
            <label className='space-y-0.5'>
              <span>Start</span>
              <NumberField value={settings.startNumber} onChange={startNumber => update({ startNumber })} />
            </label>
            <label className='space-y-0.5'>
              <span>Step</span>
              <NumberField value={settings.step} onChange={step => update({ step })} />
            </label>
          </div>
        )}
        <p className='text-xs text-gray-400'>
          {numbered ? `${headerPinName(settings, 0)} … ${lastName}` : 'Pins start without names (fill them from a pin table).'}
        </p>
      </fieldset>

      <label className='flex items-center justify-between gap-2'>
        <span>Labels</span>
        <select
          value={settings.side}
          onChange={e => update({ side: e.target.value as HeaderSideSetting })}
          className={`${inputClass} w-36 bg-white`}
        >
          {SIDES.map(([side, label]) => (
            <option key={side} value={side}>
              {side === 'auto' ? `${label} (${resolvedSide})` : label}
            </option>
          ))}
        </select>
      </label>

      <div className='flex justify-end gap-2 pt-1'>
        <button
          type='button'
          onClick={onCancel}
          className='rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100 cursor-pointer'
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={onCreate}
          className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer'
        >
          Create
        </button>
      </div>
    </div>
  );
};

/** Integer input that tolerates being emptied while typing. */
const NumberField = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const [text, setText] = useState(String(value));
  return (
    <input
      type='number'
      value={text}
      onChange={e => {
        setText(e.target.value);
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(Math.round(n));
      }}
      onBlur={() => setText(String(value))}
      className={`${inputClass} w-full`}
    />
  );
};
