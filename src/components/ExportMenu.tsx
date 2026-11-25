import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ChevronDown, FileDown } from 'lucide-react';
import type { ExportFormat, ExportOptions, PngScale } from '../utils/export';
import { defineMessages, useMessages } from '../i18n';
import { StableLabel } from './StableLabel';

const MESSAGES = defineMessages({
  en: {
    export: 'Export',
    exportTitle: 'Export the diagram as PDF, SVG or PNG',
    pdfHint: 'A4, vector — sharp in print',
    svgHint: 'Vector, for web pages and editors',
    pngHint: 'High-resolution image',
    pngSize: 'PNG size',
    transparent: 'Transparent PNG background',
    includeLegend: 'Include legend',
  },
  tr: {
    export: 'Dışa aktar',
    exportTitle: 'Diyagramı PDF, SVG veya PNG olarak dışa aktar',
    pdfHint: 'A4, vektörel — baskıda keskin',
    svgHint: 'Vektörel, web sayfaları ve düzenleyiciler için',
    pngHint: 'Yüksek çözünürlüklü görsel',
    pngSize: 'PNG boyutu',
    transparent: 'Saydam PNG arka planı',
    includeLegend: 'Lejantı dahil et',
  },
});

interface ExportMenuProps {
  onExport: (options: ExportOptions) => void;
  /** Initial state of "Include legend" each time the menu opens (the canvas legend's visibility). */
  isLegendVisible: boolean;
  /** Told when the dropdown opens or closes, so canvas shortcuts can stay out of the way. */
  onOpenChange?: (isOpen: boolean) => void;
}

const FORMATS: { format: ExportFormat; label: string; hint: 'pdfHint' | 'svgHint' | 'pngHint' }[] = [
  { format: 'pdf', label: 'PDF', hint: 'pdfHint' },
  { format: 'svg', label: 'SVG', hint: 'svgHint' },
  { format: 'png', label: 'PNG', hint: 'pngHint' },
];

const PNG_SCALES: PngScale[] = [1, 2, 4];

/** TopBar "Export" button with a small dropdown of formats and options. */
export const ExportMenu = ({ onExport, isLegendVisible, onOpenChange }: ExportMenuProps) => {
  const t = useMessages(MESSAGES);
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
        title={t.exportTitle}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isOpen
          ? 'bg-gray-100 border-gray-400 text-gray-800 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
          }`}
      >
        <FileDown size={16} /> <StableLabel text={t.export} variants={[MESSAGES.en.export, MESSAGES.tr.export]} /> <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div role='menu' className='absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 p-1 text-sm'>
          {FORMATS.map(({ format, label, hint }) => (
            <button
              key={format}
              role='menuitem'
              onClick={() => exportAs(format)}
              className='w-full text-left px-3 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-pointer'
            >
              <span className='font-medium text-gray-800 dark:text-gray-100'>{label}</span>
              <span className='block text-xs text-gray-500 dark:text-gray-400'>{t[hint]}</span>
            </button>
          ))}

          <div className='px-3 pt-1 pb-2 text-xs text-gray-600 dark:text-gray-400 flex flex-col gap-1.5'>
            <div className='flex items-center gap-1.5'>
              <span>{t.pngSize}</span>
              {PNG_SCALES.map(s => (
                <button
                  key={s}
                  onClick={() => setPngScale(s)}
                  aria-pressed={pngScale === s}
                  className={`px-1.5 py-0.5 rounded border cursor-pointer ${pngScale === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
                    }`}
                >
                  ×{s}
                </button>
              ))}
            </div>
            <label className='flex items-center gap-1.5 cursor-pointer'>
              <input type='checkbox' checked={transparent} onChange={e => setTransparent(e.target.checked)} />
              {t.transparent}
            </label>
          </div>

          <div className='border-t border-gray-200 dark:border-gray-700 px-3 py-2'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200 cursor-pointer'>
              <input type='checkbox' checked={includeLegend} onChange={e => setIncludeLegend(e.target.checked)} />
              {t.includeLegend}
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
