import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ChevronDown, FileDown, Table } from 'lucide-react';
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
    pinList: 'Pin list (CSV)',
    pinListHint: 'All pins and functions, for Excel',
    pinListEmpty: 'Add pins first: the project has none to list',
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
    pinList: 'Pin listesi (CSV)',
    pinListHint: 'Tüm pinler ve fonksiyonlar, Excel için',
    pinListEmpty: 'Önce pin ekleyin: projede listelenecek pin yok',
  },
});

interface ExportMenuProps {
  onExport: (options: ExportOptions) => void;
  /** Initial state of "Include legend" each time the menu opens (the canvas legend's visibility). */
  isLegendVisible: boolean;
  /** Told when the dropdown opens or closes, so canvas shortcuts can stay out of the way. */
  onOpenChange?: (isOpen: boolean) => void;
  /** Downloads the pins as a CSV. The "Pin list" entry is shown only when this is given. */
  onExportPinList?: () => void;
  /** False disables the "Pin list" entry (nothing to list). Defaults to true. */
  hasPins?: boolean;
  /**
   * Classes for the "Export" text, e.g. `hidden lg:inline` to show only the icon on narrow
   * screens. The button keeps "Export" as its accessible name either way.
   */
  labelClassName?: string;
}

const MENU_WIDTH = 256; // w-64
const VIEWPORT_MARGIN = 8;

const FORMATS: { format: ExportFormat; label: string; hint: 'pdfHint' | 'svgHint' | 'pngHint' }[] = [
  { format: 'pdf', label: 'PDF', hint: 'pdfHint' },
  { format: 'svg', label: 'SVG', hint: 'svgHint' },
  { format: 'png', label: 'PNG', hint: 'pngHint' },
];

const PNG_SCALES: PngScale[] = [1, 2, 4];

/** TopBar "Export" button with a small dropdown of formats and options. */
export const ExportMenu = ({ onExport, isLegendVisible, onOpenChange, onExportPinList, hasPins = true, labelClassName = '' }: ExportMenuProps) => {
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The dropdown is position:fixed so the toolbar's horizontal scroll (narrow windows) can't clip it
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

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
    // A fixed dropdown would float away from its button when the toolbar scrolls or the window resizes
    const onMove = () => close();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [isOpen]);

  const toggle = () => {
    // The legend checkbox follows the canvas legend each time; the PNG options are remembered
    if (!isOpen) {
      setIncludeLegend(isLegendVisible);
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const maxLeft = document.documentElement.clientWidth - MENU_WIDTH - VIEWPORT_MARGIN;
        setMenuPosition({ top: rect.bottom + 4, left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)) });
      }
      // PDF export loads jsPDF on demand; start fetching it now so the first export has no delay
      import('jspdf').catch(() => {});
    }
    setIsOpen(!isOpen);
  };

  const exportAs = (format: ExportFormat) => {
    setIsOpen(false);
    onExport({ format, includeLegend, pngScale, transparent });
  };

  const exportPinList = () => {
    setIsOpen(false);
    onExportPinList?.();
  };

  return (
    <div ref={rootRef} className='relative'>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={t.export}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        title={t.exportTitle}
        className={`flex shrink-0 items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isOpen
          ? 'bg-gray-100 border-gray-400 text-gray-800 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
          }`}
      >
        <FileDown size={16} />
        <span className={labelClassName}>
          <StableLabel text={t.export} variants={[MESSAGES.en.export, MESSAGES.tr.export]} />
        </span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div role='menu' style={menuPosition} className='fixed w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 p-1 text-sm'>
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

          {onExportPinList && (
            <div className='border-t border-gray-200 dark:border-gray-700 pt-1'>
              <button
                role='menuitem'
                onClick={exportPinList}
                disabled={!hasPins}
                title={hasPins ? undefined : t.pinListEmpty}
                className='w-full text-left px-3 py-1.5 rounded flex items-start gap-2 enabled:hover:bg-blue-50 dark:enabled:hover:bg-blue-900/40 enabled:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Table size={14} className='mt-0.5 shrink-0 text-gray-500 dark:text-gray-400' />
                <span>
                  <span className='font-medium text-gray-800 dark:text-gray-100'>{t.pinList}</span>
                  <span className='block text-xs text-gray-500 dark:text-gray-400'>{t.pinListHint}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
