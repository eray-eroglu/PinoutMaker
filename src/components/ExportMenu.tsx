import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ChevronDown, FileDown } from 'lucide-react';
import type { ExportFormat, ExportOptions, PngScale } from '../utils/export';

interface ExportMenuProps {
  onExport: (options: ExportOptions) => void;
  /** Initial state of "Include legend" each time the menu opens (the canvas legend's visibility). */
  isLegendVisible: boolean;
  /** Told when the dropdown opens or closes, so canvas shortcuts can stay out of the way. */
  onOpenChange?: (isOpen: boolean) => void;
}

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'pdf', label: 'PDF', hint: 'A4, vector — sharp in print' },
  { format: 'svg', label: 'SVG', hint: 'Vector, for web pages and editors' },
  { format: 'png', label: 'PNG', hint: 'High-resolution image' },
];

const PNG_SCALES: PngScale[] = [1, 2, 4];

/** TopBar "Export" button with a small dropdown of formats and options. */
export const ExportMenu = ({ onExport, isLegendVisible, onOpenChange }: ExportMenuProps) => {
  const [isOpen, setIsOpenState] = useState(false);
  const setIsOpen = (next: boolean) => {
    setIsOpenState(next);
    onOpenChange?.(next);
  };
  const close = useEffectEvent(() => setIsOpen(false));
  const [includeLegend, setIncludeLegend] = useState(isLegendVisible);
  const [pngScale, setPngScale] = useState<PngScale>(2);
  const [transparent, setTransparent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The menu is the top-most thing: Escape closes only it, not the canvas selection too
      e.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const toggle = () => {
    // The legend checkbox follows the canvas legend each time; the PNG options are remembered
    if (!isOpen) setIncludeLegend(isLegendVisible);
    setIsOpen(!isOpen);
  };

  const exportAs = (format: ExportFormat) => {
    setIsOpen(false);
    onExport({ format, includeLegend, pngScale, transparent });
  };

  return (
    <div ref={rootRef} className='relative'>
      <button
        onClick={toggle}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        title='Export the diagram as PDF, SVG or PNG'
        className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isOpen
          ? 'bg-gray-100 border-gray-400 text-gray-800'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
          }`}
      >
        <FileDown size={16} /> Export <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div role='menu' className='absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-50 p-1 text-sm'>
          {FORMATS.map(({ format, label, hint }) => (
            <button
              key={format}
              role='menuitem'
              onClick={() => exportAs(format)}
              className='w-full text-left px-3 py-1.5 rounded hover:bg-blue-50 cursor-pointer'
            >
              <span className='font-medium text-gray-800'>{label}</span>
              <span className='block text-xs text-gray-500'>{hint}</span>
            </button>
          ))}

          <div className='px-3 pt-1 pb-2 text-xs text-gray-600 flex flex-col gap-1.5'>
            <div className='flex items-center gap-1.5'>
              <span>PNG size</span>
              {PNG_SCALES.map(s => (
                <button
                  key={s}
                  onClick={() => setPngScale(s)}
                  aria-pressed={pngScale === s}
                  className={`px-1.5 py-0.5 rounded border cursor-pointer ${pngScale === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  ×{s}
                </button>
              ))}
            </div>
            <label className='flex items-center gap-1.5 cursor-pointer'>
              <input type='checkbox' checked={transparent} onChange={e => setTransparent(e.target.checked)} />
              Transparent PNG background
            </label>
          </div>

          <div className='border-t border-gray-200 px-3 py-2'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer'>
              <input type='checkbox' checked={includeLegend} onChange={e => setIncludeLegend(e.target.checked)} />
              Include legend
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
