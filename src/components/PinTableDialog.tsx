import { useMemo, useState } from 'react';
import { ClipboardPaste, TriangleAlert } from 'lucide-react';
import type { HeaderGroup } from '../utils/header';
import { describeHeader } from '../utils/header';
import { applyEntryToPin, assignRowsToHeader, parsePinTable } from '../utils/pinTable';
import { isLightColor } from '../utils/colorUtils';

interface PinTableDialogProps {
  headers: HeaderGroup[];
  /** Header to fill when the dialog opens (the selected pin's), else the first one. */
  initialHeaderId: string | null;
  labelScale: number;
  onApply: (headerId: string, rows: string[][], reverse: boolean) => void;
  onClose: () => void;
}

const PLACEHOLDER = 'PA0\tADC0\tCTS2\nPA1\tADC1\tRTS2\nGND\n\nPaste from Excel / Sheets, or CSV: PA2,ADC2,TX2';

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

  const pinCount = header?.pins.length ?? 0;
  const mismatch = rows.length > 0 && header && rows.length !== pinCount;
  const canApply = !!header && rows.length > 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30' onClick={onClose}>
      <div
        role='dialog'
        aria-label='Fill header from pin table'
        className='bg-white rounded-lg shadow-xl p-4 w-[40rem] max-w-[95vw] max-h-[90vh] flex flex-col gap-3 text-sm text-gray-700'
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          // Ctrl+Enter applies from inside the textarea, where Enter is a new line
          else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canApply && headerId) onApply(headerId, rows, reverse);
        }}
      >
        <h2 className='flex items-center gap-2 font-semibold text-gray-800'>
          <ClipboardPaste size={16} className='text-blue-600' /> Pin table
        </h2>

        {headers.length === 0 ? (
          <p className='text-gray-500'>
            There is no header to fill yet. Use <strong>Add Header</strong> to place a row of pins, then paste its table here.
          </p>
        ) : (
          <>
            <label className='flex items-center gap-2'>
              <span className='shrink-0'>Header</span>
              <select
                value={headerId ?? ''}
                onChange={e => setHeaderId(e.target.value)}
                className='flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 bg-white outline-none focus:border-blue-500'
              >
                {headers.map(h => (
                  <option key={h.id} value={h.id}>{describeHeader(h)}</option>
                ))}
              </select>
            </label>

            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              rows={7}
              aria-label='Pin table'
              className='w-full border border-gray-300 rounded px-2 py-1.5 font-mono text-xs outline-none focus:border-blue-500 resize-y'
            />
            <p className='text-xs text-gray-400 -mt-2'>
              One line per pin: name first, then its functions (nearest the pin first). Tabs, commas or semicolons.
            </p>

            <label className='flex items-center gap-2 cursor-pointer'>
              <input type='checkbox' checked={reverse} onChange={e => setReverse(e.target.checked)} className='rounded border-gray-300' />
              Reverse order <span className='text-xs text-gray-400'>(first row goes to the last pin)</span>
            </label>

            {mismatch && (
              <div role='alert' className='flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800'>
                <TriangleAlert size={14} className='shrink-0 mt-0.5' />
                {rows.length > pinCount
                  ? `The table has ${rows.length} rows but the header has ${pinCount} pins; the last ${rows.length - pinCount} rows are ignored.`
                  : `The table has ${rows.length} rows but the header has ${pinCount} pins; ${pinCount - rows.length} pins stay unchanged.`}
              </div>
            )}

            {rows.length > 0 && (
              <div className='overflow-auto border border-gray-200 rounded min-h-0'>
                <table className='w-full text-xs'>
                  <thead className='bg-gray-50 text-gray-500 sticky top-0'>
                    <tr>
                      <th className='text-left font-medium px-2 py-1 w-10'>#</th>
                      <th className='text-left font-medium px-2 py-1 w-20'>Now</th>
                      <th className='text-left font-medium px-2 py-1'>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(({ pin, result }, i) => (
                      <tr key={pin.id} className='border-t border-gray-100'>
                        <td className='px-2 py-1 text-gray-400 tabular-nums'>{i + 1}</td>
                        <td className='px-2 py-1 text-gray-500 truncate max-w-[5rem]'>{pin.text || '—'}</td>
                        <td className='px-2 py-1'>
                          {result ? (
                            <div className='flex flex-wrap gap-1'>
                              <Chip text={result.text} color={result.color} />
                              {result.functions?.map(fn => <Chip key={fn.id} text={fn.text} color={fn.color} />)}
                            </div>
                          ) : (
                            <span className='text-gray-400 italic'>unchanged</span>
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
            className='rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100 cursor-pointer'
          >
            Cancel
          </button>
          <button
            type='button'
            disabled={!canApply}
            onClick={() => headerId && onApply(headerId, rows, reverse)}
            title='Apply (Ctrl+Enter)'
            className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed'
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
