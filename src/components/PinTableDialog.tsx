import { useMemo, useState } from 'react';
import { ClipboardPaste, TriangleAlert } from 'lucide-react';
import type { HeaderGroup } from '../utils/header';
import { describeHeader } from '../utils/header';
import { applyEntryToPin, assignRowsToHeader, parsePinTable, pinTableWarnings } from '../utils/pinTable';
import { isLightColor } from '../utils/colorUtils';
import { defineMessages, useLanguage, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    dialogLabel: 'Fill header from pin table',
    title: 'Pin table',
    noHeaderBefore: 'There is no header to fill yet. Use ',
    addHeader: 'Add Header',
    noHeaderAfter: ' to place a row of pins, then paste its table here.',
    header: 'Header',
    placeholder: 'PA0\tADC0\tCTS2\nPA1\tADC1\tRTS2\nGND\n\nPaste from Excel / Sheets, or CSV: PA2,ADC2,TX2',
    tableLabel: 'Pin table',
    help: 'One line per pin: name first, then its functions (nearest the pin first). Tabs, commas or semicolons.',
    reverse: 'Reverse order',
    reverseHint: '(first row goes to the last pin)',
    now: 'Now',
    after: 'After',
    unchanged: 'unchanged',
    cancel: 'Cancel',
    apply: 'Apply',
    applyTitle: 'Apply (Ctrl+Enter)',
  },
  tr: {
    dialogLabel: "Header'ı pin tablosundan doldur",
    title: 'Pin tablosu',
    noHeaderBefore: 'Henüz doldurulacak bir header yok. Bir pin sırası yerleştirmek için ',
    addHeader: 'Header ekle',
    noHeaderAfter: ' aracını kullanın, ardından tablosunu buraya yapıştırın.',
    header: 'Header',
    placeholder: "PA0\tADC0\tCTS2\nPA1\tADC1\tRTS2\nGND\n\nExcel / Sheets'ten veya CSV olarak yapıştırın: PA2,ADC2,TX2",
    tableLabel: 'Pin tablosu',
    help: 'Her pin için bir satır: önce adı, sonra fonksiyonları (pine en yakın olan önce). Sekme, virgül veya noktalı virgül.',
    reverse: 'Ters sıra',
    reverseHint: '(ilk satır son pine gider)',
    now: 'Şimdi',
    after: 'Sonra',
    unchanged: 'değişmez',
    cancel: 'İptal',
    apply: 'Uygula',
    applyTitle: 'Uygula (Ctrl+Enter)',
  },
});

interface PinTableDialogProps {
  headers: HeaderGroup[];
  /** Header to fill when the dialog opens (the selected pin's), else the first one. */
  initialHeaderId: string | null;
  labelScale: number;
  onApply: (headerId: string, rows: string[][], reverse: boolean) => void;
  onClose: () => void;
}

const Chip = ({ text, color }: { text: string; color: string }) => (
  <span
    className='inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap'
    style={{ backgroundColor: color, color: isLightColor(color) ? 'black' : 'white' }}
  >
    {text || ' '}
  </span>
);

/** Fills a header's pins from a pasted table: one line per pin, name first, then its functions. */
export const PinTableDialog = ({ headers, initialHeaderId, labelScale, onApply, onClose }: PinTableDialogProps) => {
  const t = useMessages(MESSAGES);
  const { language } = useLanguage();
  const [headerId, setHeaderId] = useState(() =>
    headers.some(h => h.id === initialHeaderId) ? initialHeaderId : (headers[0]?.id ?? null),
  );
  const [text, setText] = useState('');
  const [reverse, setReverse] = useState(false);

  const header = headers.find(h => h.id === headerId) ?? null;
  const rows = useMemo(() => parsePinTable(text), [text]);
  // The preview runs the same code as Apply, so the chips show exactly the colours that will be set
  const preview = useMemo(() => {
    if (!header) return [];
    let n = 0;
    return assignRowsToHeader(header.pins, rows, reverse).map(({ pin, entry }) => ({
      pin,
      result: entry ? applyEntryToPin(pin, entry, { labelScale, newId: () => `preview-${n++}` }) : null,
    }));
  }, [header, rows, reverse, labelScale]);

  const warnings = header ? pinTableWarnings(header.pins, rows.length, reverse, language) : [];
  const canApply = !!header && rows.length > 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30' onClick={onClose}>
      <div
        role='dialog'
        aria-label={t.dialogLabel}
        className='bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 w-[40rem] max-w-[95vw] max-h-[90vh] flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-200'
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          // Ctrl+Enter applies from inside the textarea, where Enter is a new line
          else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canApply && headerId) onApply(headerId, rows, reverse);
        }}
      >
        <h2 className='flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100'>
          <ClipboardPaste size={16} className='text-blue-600' /> {t.title}
        </h2>

        {headers.length === 0 ? (
          <p className='text-gray-500 dark:text-gray-400'>
            {t.noHeaderBefore}<strong>{t.addHeader}</strong>{t.noHeaderAfter}
          </p>
        ) : (
          <>
            <label className='flex items-center gap-2'>
              <span className='shrink-0'>{t.header}</span>
              <select
                value={headerId ?? ''}
                onChange={e => setHeaderId(e.target.value)}
                className='flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 outline-none focus:border-blue-500'
              >
                {headers.map(h => (
                  <option key={h.id} value={h.id}>{describeHeader(h, language)}</option>
                ))}
              </select>
            </label>

            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t.placeholder}
              spellCheck={false}
              rows={7}
              aria-label={t.tableLabel}
              className='w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded px-2 py-1.5 font-mono text-xs outline-none focus:border-blue-500 resize-y'
            />
            <p className='text-xs text-gray-400 dark:text-gray-500 -mt-2'>
              {t.help}
            </p>

            <label className='flex items-center gap-2 cursor-pointer'>
              <input type='checkbox' checked={reverse} onChange={e => setReverse(e.target.checked)} className='rounded border-gray-300 dark:border-gray-600' />
              {t.reverse} <span className='text-xs text-gray-400 dark:text-gray-500'>{t.reverseHint}</span>
            </label>

            {warnings.length > 0 && (
              <div role='alert' className='flex items-start gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300'>
                <TriangleAlert size={14} className='shrink-0 mt-0.5' />
                <div>
                  {warnings.map(w => <p key={w}>{w}</p>)}
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className='overflow-auto border border-gray-200 dark:border-gray-700 rounded min-h-0'>
                <table className='w-full text-xs'>
                  <thead className='bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 sticky top-0'>
                    <tr>
                      <th className='text-left font-medium px-2 py-1 w-10'>#</th>
                      <th className='text-left font-medium px-2 py-1 w-20'>{t.now}</th>
                      <th className='text-left font-medium px-2 py-1'>{t.after}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ pin, result }, i) => (
                      <tr key={pin.id} className='border-t border-gray-100 dark:border-gray-800'>
                        {/* The pad number, which stays put when other pins of the header are removed */}
                        <td className='px-2 py-1 text-gray-400 dark:text-gray-500 tabular-nums'>{(pin.headerIndex ?? i) + 1}</td>
                        <td className='px-2 py-1 text-gray-500 dark:text-gray-400 truncate max-w-[5rem]'>{pin.text || '—'}</td>
                        <td className='px-2 py-1'>
                          {result ? (
                            <div className='flex flex-wrap gap-1'>
                              <Chip text={result.text} color={result.color} />
                              {result.functions?.map(fn => <Chip key={fn.id} text={fn.text} color={fn.color} />)}
                            </div>
                          ) : (
                            <span className='text-gray-400 dark:text-gray-500 italic'>{t.unchanged}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
          >
            {t.cancel}
          </button>
          <button
            type='button'
            disabled={!canApply}
            onClick={() => headerId && onApply(headerId, rows, reverse)}
            title={t.applyTitle}
            className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-500 disabled:cursor-not-allowed'
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
};
