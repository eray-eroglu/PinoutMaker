import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { MAX_HEADER_PINS, clampHeaderCount, headerPinName } from '../utils/header';
import type { HeaderSettings, HeaderSide, HeaderSideSetting } from '../utils/header';
import { defineMessages, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    title: 'New header',
    pins: 'Pins',
    names: 'Names',
    naming: 'Naming',
    numbered: 'Numbered',
    blank: 'Blank',
    prefix: 'Prefix',
    start: 'Start',
    step: 'Step',
    blankHint: 'Pins start without names (fill them from a pin table).',
    labels: 'Labels',
    auto: 'Auto',
    left: 'Left',
    right: 'Right',
    above: 'Above',
    below: 'Below',
    cancel: 'Cancel',
    create: 'Create',
  },
  tr: {
    title: 'Yeni header',
    pins: 'Pinler',
    names: 'İsimler',
    naming: 'İsimlendirme',
    numbered: 'Numaralı',
    blank: 'Boş',
    prefix: 'Önek',
    start: 'Başlangıç',
    step: 'Adım',
    blankHint: 'Pinler isimsiz başlar (isimleri bir pin tablosundan doldurun).',
    labels: 'Etiketler',
    auto: 'Otomatik',
    left: 'Sol',
    right: 'Sağ',
    above: 'Üst',
    below: 'Alt',
    cancel: 'İptal',
    create: 'Oluştur',
  },
});

interface HeaderPanelProps {
  settings: HeaderSettings;
  onChange: (settings: HeaderSettings) => void;
  /** What 'auto' currently resolves to, shown next to the option. */
  resolvedSide: HeaderSide;
  onCreate: () => void;
  onCancel: () => void;
}

const SIDES: HeaderSideSetting[] = ['auto', 'left', 'right', 'above', 'below'];

const inputClass = 'border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm outline-none focus:border-blue-500';

/** Settings for a header whose first and last pads were just picked; the canvas previews them live. */
export const HeaderPanel = ({ settings, onChange, resolvedSide, onCreate, onCancel }: HeaderPanelProps) => {
  const t = useMessages(MESSAGES);
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
      aria-label={t.title}
      className='absolute top-3 left-3 z-20 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-200 shadow-lg space-y-3'
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel();
        else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) onCreate();
      }}
    >
      <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100'>
        <GripVertical size={16} className='text-blue-600 dark:text-blue-400' /> {t.title}
      </div>

      <label className='flex items-center justify-between gap-2'>
        <span>{t.pins}</span>
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
        <legend className='mb-1'>{t.names}</legend>
        <div className='flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-xs' role='group' aria-label={t.naming}>
          {(['numbered', 'blank'] as const).map(naming => (
            <button
              key={naming}
              type='button'
              aria-pressed={settings.naming === naming}
              onClick={() => update({ naming })}
              className={`flex-1 px-2 py-1 border-r last:border-r-0 border-gray-300 dark:border-gray-600 ${settings.naming === naming ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {t[naming]}
            </button>
          ))}
        </div>
        {numbered && (
          <div className='grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400'>
            <label className='space-y-0.5'>
              <span>{t.prefix}</span>
              <input
                type='text'
                value={settings.prefix}
                onChange={e => update({ prefix: e.target.value })}
                className={`${inputClass} w-full`}
              />
            </label>
            <label className='space-y-0.5'>
              <span>{t.start}</span>
              <NumberField value={settings.startNumber} onChange={startNumber => update({ startNumber })} />
            </label>
            <label className='space-y-0.5'>
              <span>{t.step}</span>
              <NumberField value={settings.step} onChange={step => update({ step })} />
            </label>
          </div>
        )}
        <p className='text-xs text-gray-400 dark:text-gray-500'>
          {numbered ? `${headerPinName(settings, 0)} … ${lastName}` : t.blankHint}
        </p>
      </fieldset>

      <label className='flex items-center justify-between gap-2'>
        <span>{t.labels}</span>
        <select
          value={settings.side}
          onChange={e => update({ side: e.target.value as HeaderSideSetting })}
          className={`${inputClass} w-36 bg-white`}
        >
          {SIDES.map(side => (
            <option key={side} value={side}>
              {side === 'auto' ? `${t.auto} (${t[resolvedSide].toLowerCase()})` : t[side]}
            </option>
          ))}
        </select>
      </label>

      <div className='flex justify-end gap-2 pt-1'>
        <button
          type='button'
          onClick={onCancel}
          className='rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
        >
          {t.cancel}
        </button>
        <button
          type='button'
          onClick={onCreate}
          className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer'
        >
          {t.create}
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
