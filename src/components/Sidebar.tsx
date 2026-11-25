import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { PinData, LineData, LegendItem, LegendMode } from '../types';
import type { LoadedImage } from '../utils/project';
import { isLightColor } from '../utils/colorUtils';
import {
  addPinFunction,
  getColorForRename,
  movePinFunction,
  nudgeLabel,
  removePinFunction,
  renamePinFunction,
  updatePinFunction,
} from '../utils/pinUtils';
import { colorPickerSession, useEditSession } from '../hooks/useEditSession';
import { defineMessages, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    customColor: 'Custom Color',
    projectSettings: 'Project Settings',
    gapSize: 'Global Gap Size (px)',
    gapHelp: 'Distance between pins',
    labelSize: 'Label Size',
    smallerLabels: 'Smaller labels',
    largerLabels: 'Larger labels',
    labelSizeHelp: 'Labels zoom with the board. Resizing keeps their spacing proportional.',
    anchorSize: 'Anchor Size',
    anchorHidden: 'Anchor is hidden. Straight line only.',
    tableSettings: 'Table Settings',
    showTable: 'Show Table on Canvas',
    show: 'Show',
    tableRowsToShow: 'Table rows to show',
    allRows: 'All rows',
    usedColours: 'Only used colours',
    dimUnused: 'Dim unused',
    showCounts: 'Show counts',
    rows: 'Rows',
    removeRow: 'Remove row',
    addRow: '+ Add Row',
    imageProperties: 'Image Properties',
    width: 'Width (px)',
    height: 'Height (px)',
    aspectHelp: 'Aspect ratio is maintained automatically.',
    exportPinout: 'Export as library pinout',
    exportPinoutTitle: 'Download the current pins and lines, relative to this image, as a ready-made pinout for the product library',
    lineProperties: 'Line Properties',
    pinProperties: 'Pin Properties',
    selectHint: 'Select a pin or line to edit properties.',
    lineColor: 'Line Color',
    thickness: 'Thickness (px)',
    headerPin: (index: number, count: number) => `Header pin ${index} of ${count}`,
    fillFromTable: 'Fill header from table…',
    fillFromTableTitle: 'Paste a pin table (datasheet, Excel, CSV) to name every pin of this header',
    pinName: 'Pin Name',
    labelColor: 'Label Color',
    textColor: 'Text Color',
    customTextColor: 'Custom Text Color',
    pickTextColor: 'Pick a custom text color',
    pwmCapable: 'PWM Capable',
    functions: 'Functions',
    functionsHelp: 'Extra labels shown after the pin name, continuing away from the anchor.',
    functionColor: 'Function color',
    colorOf: (name: string) => `Color of ${name || 'function'}`,
    functionPlaceholder: 'e.g. ADC0',
    moveCloser: 'Move closer to the pin name',
    moveFurther: 'Move further out',
    removeFunction: 'Remove function',
    addFunction: '+ Add function',
    positionAdjustment: 'Position Adjustment (px)',
    step: 'Step:',
    moveUp: (px: number) => `Move Up ${px}px`,
    moveLeft: (px: number) => `Move Left ${px}px`,
    moveRight: (px: number) => `Move Right ${px}px`,
    moveDown: (px: number) => `Move Down ${px}px`,
    positionHelp: "Use these buttons to fine-tune the label's position relative to other pins.",
  },
  tr: {
    customColor: 'Özel renk',
    projectSettings: 'Proje Ayarları',
    gapSize: 'Genel boşluk (px)',
    gapHelp: 'Pinler arasındaki mesafe',
    labelSize: 'Etiket Boyutu',
    smallerLabels: 'Daha küçük etiketler',
    largerLabels: 'Daha büyük etiketler',
    labelSizeHelp: 'Etiketler kartla birlikte yakınlaşır. Boyut değişince aralarındaki boşluk orantılı kalır.',
    anchorSize: 'Bağlantı Noktası Boyutu',
    anchorHidden: 'Bağlantı noktası gizli. Yalnızca düz çizgi.',
    tableSettings: 'Tablo Ayarları',
    showTable: 'Tabloyu tuvalde göster',
    show: 'Göster',
    tableRowsToShow: 'Gösterilecek tablo satırları',
    allRows: 'Tüm satırlar',
    usedColours: 'Yalnızca kullanılan renkler',
    dimUnused: 'Kullanılmayanları soluklaştır',
    showCounts: 'Sayıları göster',
    rows: 'Satırlar',
    removeRow: 'Satırı sil',
    addRow: '+ Satır ekle',
    imageProperties: 'Görsel Özellikleri',
    width: 'Genişlik (px)',
    height: 'Yükseklik (px)',
    aspectHelp: 'En-boy oranı otomatik olarak korunur.',
    exportPinout: "Kütüphane pinout'u olarak dışa aktar",
    exportPinoutTitle: 'Mevcut pinleri ve çizgileri, bu görsele göre, ürün kütüphanesi için hazır bir pinout olarak indir',
    lineProperties: 'Çizgi Özellikleri',
    pinProperties: 'Pin Özellikleri',
    selectHint: 'Özelliklerini düzenlemek için bir pin veya çizgi seçin.',
    lineColor: 'Çizgi rengi',
    thickness: 'Kalınlık (px)',
    headerPin: (index: number, count: number) => `Header pini ${index} / ${count}`,
    fillFromTable: "Header'ı tablodan doldur…",
    fillFromTableTitle: "Bu header'ın tüm pinlerini adlandırmak için bir pin tablosu yapıştırın (datasheet, Excel, CSV)",
    pinName: 'Pin Adı',
    labelColor: 'Etiket rengi',
    textColor: 'Yazı rengi',
    customTextColor: 'Özel yazı rengi',
    pickTextColor: 'Özel bir yazı rengi seçin',
    pwmCapable: 'PWM destekli',
    functions: 'Fonksiyonlar',
    functionsHelp: 'Pin adından sonra, bağlantı noktasından uzaklaşarak gösterilen ek etiketler.',
    functionColor: 'Fonksiyon rengi',
    colorOf: (name: string) => `${name || 'Fonksiyon'} rengi`,
    functionPlaceholder: 'ör. ADC0',
    moveCloser: 'Pin adına yaklaştır',
    moveFurther: 'Dışarı taşı',
    removeFunction: 'Fonksiyonu sil',
    addFunction: '+ Fonksiyon ekle',
    positionAdjustment: 'Konum Ayarı (px)',
    step: 'Adım:',
    moveUp: (px: number) => `${px}px yukarı taşı`,
    moveLeft: (px: number) => `${px}px sola taşı`,
    moveRight: (px: number) => `${px}px sağa taşı`,
    moveDown: (px: number) => `${px}px aşağı taşı`,
    positionHelp: 'Etiketin diğer pinlere göre konumunu ince ayarlamak için bu düğmeleri kullanın.',
  },
});

/** Detail of the window 'focus-sidebar-input' event: which label's editor to focus. */
export interface FocusSidebarInputDetail {
  /** Index into the pin's functions; -1 focuses the pin name. */
  functionIndex: number;
}

interface SidebarProps {
  selectedPin: PinData | null;
  /** Shown instead of the pin editor while two or more pins are selected. */
  multiPinPanel?: ReactNode;
  /** Label of the selected pin picked on the canvas (-1 = primary label). */
  selectedFunctionIndex: number;
  onSelectFunctionIndex: (index: number) => void;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  selectedImage: LoadedImage | null;
  onUpdateImage: (img: LoadedImage, saveHistory?: boolean) => void;
  selectedLine: LineData | null;
  onUpdateLine: (line: LineData, saveHistory?: boolean) => void;
  /** Downloads the pins/lines relative to the selected image as a Boardoza library pinout (JSON). */
  onExportPinoutTemplate: () => void;
  gapSize: number;
  onGapSizeChange: (size: number) => void;
  legendItems: LegendItem[];
  /** `saveHistory` false: continues the undo step of the current typing / picker session. */
  onLegendItemsChange: (items: LegendItem[], saveHistory?: boolean) => void;
  isLegendVisible: boolean;
  onLegendVisibilityChange: (visible: boolean) => void;
  legendMode: LegendMode;
  onLegendModeChange: (mode: LegendMode) => void;
  legendShowCounts: boolean;
  onLegendShowCountsChange: (show: boolean) => void;
  anchorSize: number;
  onAnchorSizeChange: (size: number) => void;
  /** World size of one label unit. */
  labelScale: number;
  onLabelScaleChange: (labelScale: number) => void;
  /** Where the selected pin sits in its header (index is 0-based), or null for a stand-alone pin. */
  selectedPinHeader?: { index: number; count: number } | null;
  /** Opens the pin table dialog for the selected pin's header. */
  onOpenPinTable?: () => void;
}

const COLORS = [
  '#dc2626', // POWER (Red)
  '#000000', // GROUND (Black)
  '#0d9488', // PHYSICAL PIN (Teal)
  '#ca8a04', // PIN NAME / CONTROL (Yellow/Gold)
  '#16a34a', // ANALOG (Green)
  '#e11d48', // TIMER & CHANNEL (Rose)
  '#1d4ed8', // USART (Dark Blue)
  '#9333ea', // SPI (Purple)
  '#0ea5e9', // I2C (Light Blue)
  '#db2777', // CAN BUS (Pink)
  '#65a30d', // USB (Olive Green)
  '#4b5563', // MISC (Gray)
  '#ea580c', // BOARD HARDWARE (Orange)
  '#1f2937', // gray-800 (default/neutral)
];

/**
 * Palette swatches plus a custom color picker; the selected color gets a ring.
 * `value` null means no single colour (several pins with different colours): nothing is ringed.
 * `saveHistory` is true for a swatch click and for the first colour of a picker session, so
 * dragging through the picker is one undo step.
 */
export const ColorPalette = ({ value, onChange }: {
  value: string | null;
  onChange: (color: string, saveHistory: boolean) => void;
}) => {
  const t = useMessages(MESSAGES);
  const pickerSession = useEditSession();
  return (
    <div className='grid grid-cols-4 gap-2'>
      {COLORS.map((c) => (
        <div
          key={c}
          className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110`}
          style={{
            backgroundColor: c,
            boxShadow: value === c ? '0 0 0 2px var(--swatch-ring-gap), 0 0 0 4px gray' : 'none',
          }}
          onClick={() => onChange(c, true)}
        ></div>
      ))}
      <div
        className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 relative flex items-center justify-center overflow-hidden`}
        style={{
          background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
          boxShadow: value !== null && !COLORS.includes(value) ? '0 0 0 2px var(--swatch-ring-gap), 0 0 0 4px gray' : 'none',
        }}
        title={t.customColor}
      >
        <input
          type="color"
          value={value ?? '#000000'}
          {...colorPickerSession(pickerSession, onChange)}
          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
        />
      </div>
    </div>
  );
};

export const Sidebar = ({
  selectedPin, multiPinPanel, selectedFunctionIndex, onSelectFunctionIndex, onUpdatePin, selectedImage, onUpdateImage,
  selectedLine, onUpdateLine,
  onExportPinoutTemplate, gapSize, onGapSizeChange,
  legendItems, onLegendItemsChange, isLegendVisible, onLegendVisibilityChange,
  legendMode, onLegendModeChange, legendShowCounts, onLegendShowCountsChange, anchorSize, onAnchorSizeChange,
  labelScale, onLabelScaleChange, selectedPinHeader, onOpenPinTable,
}: SidebarProps) => {
  const t = useMessages(MESSAGES);
  const [customStep, setCustomStep] = useState<number>(5);
  const [isTableSettingsExpanded, setIsTableSettingsExpanded] = useState<boolean>(false);
  // Function whose color palette is open (by id, so it survives reordering)
  const [colorEditorFunctionId, setColorEditorFunctionId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const functionInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  // "+ Add function" already recorded history; typing into the new input continues that step
  const skipFocusHistoryRef = useRef(false);
  // Text fields: one undo step per focus, recorded on the first change (an untouched field records nothing)
  const fieldSession = useEditSession();
  const textColorSession = useEditSession();
  const legendColorSession = useEditSession();

  useEffect(() => {
    const handleFocus = (e: Event) => {
      const functionIndex = (e as CustomEvent<FocusSidebarInputDetail | undefined>).detail?.functionIndex ?? -1;
      // Wait a frame: the sidebar may still be rendering the newly selected pin
      requestAnimationFrame(() => {
        const input = functionIndex >= 0 ? functionInputRefs.current[functionIndex] : nameInputRef.current;
        input?.focus();
        input?.select();
      });
    };

    window.addEventListener('focus-sidebar-input', handleFocus);
    return () => window.removeEventListener('focus-sidebar-input', handleFocus);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPin) {
      const newText = e.target.value;
      onUpdatePin({
        ...selectedPin,
        text: newText,
        color: getColorForRename(selectedPin, newText),
      }, fieldSession.next());
    }
  };

  const handleColorChange = (color: string, saveHistory: boolean) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, color }, saveHistory);
    }
  };

  const handlePwmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, isPwm: e.target.checked });
    }
  };

  const handleTextColorChange = (color: string, saveHistory: boolean) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, textColor: color }, saveHistory);
    }
  };

  // --- Function labels ---
  const functions = selectedPin?.functions ?? [];

  const handleAddFunction = () => {
    if (!selectedPin) return;
    onUpdatePin(addPinFunction(selectedPin));
    const newIndex = functions.length;
    onSelectFunctionIndex(newIndex);
    requestAnimationFrame(() => {
      // focus() runs the onFocus handler synchronously, which reads the flag
      skipFocusHistoryRef.current = true;
      functionInputRefs.current[newIndex]?.focus();
      skipFocusHistoryRef.current = false;
    });
  };

  const handleFunctionFocus = (index: number) => {
    onSelectFunctionIndex(index);
    // One undo step per editing session, like the pin name
    fieldSession.start(skipFocusHistoryRef.current);
  };

  const handleMoveFunction = (index: number, delta: -1 | 1) => {
    if (!selectedPin) return;
    onUpdatePin(movePinFunction(selectedPin, index, delta));
    if (selectedFunctionIndex === index) onSelectFunctionIndex(index + delta);
    else if (selectedFunctionIndex === index + delta) onSelectFunctionIndex(index);
  };

  const handleRemoveFunction = (index: number) => {
    if (!selectedPin) return;
    onUpdatePin(removePinFunction(selectedPin, index));
    if (selectedFunctionIndex === index) onSelectFunctionIndex(-1);
    else if (selectedFunctionIndex > index) onSelectFunctionIndex(selectedFunctionIndex - 1);
  };

  // --- Position Adjustment ---
  // Steps are board-image pixels, the same units as every position on the board.
  const nudge = (dx: number, dy: number) => {
    if (selectedPin) onUpdatePin(nudgeLabel(selectedPin, dx, dy));
  };
  const handleMoveLeft = (px: number) => nudge(-px, 0);
  const handleMoveRight = (px: number) => nudge(px, 0);
  const handleMoveUp = (px: number) => nudge(0, -px);
  const handleMoveDown = (px: number) => nudge(0, px);

  // Text and colour edits of a row: one undo step per typing / picker session
  const updateLegendItem = (index: number, changes: Partial<LegendItem>, saveHistory: boolean) => {
    onLegendItemsChange(legendItems.map((item, i) => (i === index ? { ...item, ...changes } : item)), saveHistory);
  };

  return (
    <div className='w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-300 dark:border-gray-600 flex flex-col p-4 shrink-0 h-full overflow-y-auto'>
      <h2 className='text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200'>
        {t.projectSettings}
      </h2>
      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
          {t.gapSize}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={gapSize}
            onChange={(e) => {
              const value = e.target.valueAsNumber;
              if (Number.isFinite(value)) onGapSizeChange(Math.min(100, Math.max(0, value)));
            }}
            className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{t.gapHelp}</span>
        </div>
      </div>

      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
          {t.labelSize}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLabelScaleChange(labelScale / 1.1)}
            className="w-8 h-7 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-sm font-bold"
            title={t.smallerLabels}
          >
            −
          </button>
          <span className="w-14 text-center text-sm text-gray-700 dark:text-gray-200 tabular-nums">{Math.round(labelScale * 100)}%</span>
          <button
            onClick={() => onLabelScaleChange(labelScale * 1.1)}
            className="w-8 h-7 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-sm font-bold"
            title={t.largerLabels}
          >
            +
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t.labelSizeHelp}</p>
      </div>

      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
          {t.anchorSize}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="15"
            step="1"
            value={anchorSize}
            onChange={(e) => onAnchorSizeChange(Number(e.target.value))}
            className="flex-1 custom-range-slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(anchorSize / 15) * 100}%, #e5e7eb ${(anchorSize / 15) * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{anchorSize}px</span>
        </div>
        {anchorSize === 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t.anchorHidden}</p>
        )}
      </div>

      <button
        onClick={() => setIsTableSettingsExpanded(!isTableSettingsExpanded)}
        className='flex items-center justify-between w-full text-left text-lg font-semibold mb-4 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-gray-100'
      >
        <span>{t.tableSettings}</span>
        <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
          {isTableSettingsExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isTableSettingsExpanded && (
        <div className="mb-6 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isLegendVisible}
              onChange={(e) => onLegendVisibilityChange(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            {t.showTable}
          </label>

          {isLegendVisible && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t.show}</div>
              <div className="flex rounded border border-gray-300 dark:border-gray-600 overflow-hidden text-xs" role="group" aria-label={t.tableRowsToShow}>
                {([['all', t.allRows], ['used', t.usedColours], ['dimUnused', t.dimUnused]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={legendMode === mode}
                    onClick={() => { if (mode !== legendMode) onLegendModeChange(mode); }}
                    className={`flex-1 px-1 py-1 border-r last:border-r-0 border-gray-300 dark:border-gray-600 ${legendMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={legendShowCounts}
                  onChange={(e) => onLegendShowCountsChange(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                {t.showCounts}
              </label>
            </div>
          )}

          {isLegendVisible && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t.rows}</div>
              {legendItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={item.color}
                    {...colorPickerSession(legendColorSession, (color, saveHistory) => updateLegendItem(index, { color }, saveHistory))}
                    className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateLegendItem(index, { text: e.target.value }, fieldSession.next())}
                    onFocus={() => fieldSession.start()}
                    onBlur={fieldSession.end}
                    className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      onLegendItemsChange(legendItems.filter((_, i) => i !== index), true);
                    }}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1"
                    title={t.removeRow}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  onLegendItemsChange([...legendItems, { id: crypto.randomUUID(), text: 'NEW ROW', color: '#888888' }], true);
                }}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-1 font-medium"
              >
                {t.addRow}
              </button>
            </div>
          )}
        </div>
      )}

      <hr className="my-4 border-gray-300 dark:border-gray-600" />

      {selectedImage && (
        <>
          <h2 className='text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200'>
            {t.imageProperties}
          </h2>
          <div className='space-y-4 mb-4'>
            <div>
              <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                {t.width}
              </label>
              <input
                type='number'
                className='w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100'
                value={Math.round(selectedImage.width)}
                onChange={(e) => {
                  const newW = Number(e.target.value);
                  if (newW > 0) {
                    const ratio = selectedImage.height / selectedImage.width;
                    onUpdateImage({
                      ...selectedImage,
                      width: newW,
                      height: newW * ratio
                    }, fieldSession.next());
                  }
                }}
                onFocus={() => fieldSession.start()}
                onBlur={fieldSession.end}
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
                {t.height}
              </label>
              <input
                type='number'
                className='w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100'
                value={Math.round(selectedImage.height)}
                onChange={(e) => {
                  const newH = Number(e.target.value);
                  if (newH > 0) {
                    const ratio = selectedImage.width / selectedImage.height;
                    onUpdateImage({
                      ...selectedImage,
                      height: newH,
                      width: newH * ratio
                    }, fieldSession.next());
                  }
                }}
                onFocus={() => fieldSession.start()}
                onBlur={fieldSession.end}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.aspectHelp}
            </p>
            <button
              onClick={onExportPinoutTemplate}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline cursor-pointer"
              title={t.exportPinoutTitle}
            >
              {t.exportPinout}
            </button>
          </div>
          <hr className="my-4 border-gray-300 dark:border-gray-600" />
        </>
      )}

      <h2 className='text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200'>
        {selectedLine ? t.lineProperties : t.pinProperties}
      </h2>

      {multiPinPanel ? (
        multiPinPanel
      ) : !selectedPin && !selectedLine ? (
        <div className='text-gray-400 dark:text-gray-500 text-sm'>
          {t.selectHint}
        </div>
      ) : selectedLine ? (
        <div className='space-y-4'>
           <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
              {t.lineColor}
            </label>
            <div className='grid grid-cols-4 gap-2'>
              {COLORS.map((c) => (
                <div
                  key={`line-c-${c}`}
                  className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110`}
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      selectedLine.color === c
                        ? '0 0 0 2px var(--swatch-ring-gap), 0 0 0 4px gray'
                        : 'none',
                  }}
                  onClick={() => onUpdateLine({ ...selectedLine, color: c })}
                ></div>
              ))}
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
              {t.thickness}
            </label>
            <input
              type='number'
              min='1'
              className='w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100'
              value={selectedLine.thickness}
              onChange={(e) => onUpdateLine({ ...selectedLine, thickness: Number(e.target.value) || 1 }, fieldSession.next())}
              onFocus={() => fieldSession.start()}
              onBlur={fieldSession.end}
            />
          </div>
        </div>
      ) : selectedPin ? (
        <div className='space-y-4'>
          {selectedPinHeader && (
            <div className='flex items-center justify-between gap-2 rounded border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300'>
              <span>{t.headerPin(selectedPinHeader.index + 1, selectedPinHeader.count)}</span>
              {onOpenPinTable && (
                <button
                  onClick={onOpenPinTable}
                  className='font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 underline cursor-pointer'
                  title={t.fillFromTableTitle}
                >
                  {t.fillFromTable}
                </button>
              )}
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
              {t.pinName}
            </label>
            <input
              ref={nameInputRef}
              type='text'
              className='w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100'
              value={selectedPin.text}
              onChange={handleNameChange}
              onFocus={() => {
                onSelectFunctionIndex(-1);
                fieldSession.start();
              }}
              onBlur={fieldSession.end}
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
              {t.labelColor}
            </label>
            <ColorPalette value={selectedPin.color} onChange={handleColorChange} />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
              {t.textColor}
            </label>
            <div className='flex items-center gap-2'>
              <div
                className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 relative flex items-center justify-center overflow-hidden border border-gray-300 dark:border-gray-600`}
                title={t.customTextColor}
              >
                <input
                  type="color"
                  value={selectedPin.textColor || (isLightColor(selectedPin.color) ? '#000000' : '#ffffff')}
                  {...colorPickerSession(textColorSession, handleTextColorChange)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                />
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: selectedPin.textColor || (isLightColor(selectedPin.color) ? '#000000' : '#ffffff') }}
                ></div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.pickTextColor}</span>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              className='rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500'
              checked={selectedPin.isPwm}
              onChange={handlePwmChange}
            />
            <label className='text-sm text-gray-600 dark:text-gray-400'>{t.pwmCapable}</label>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1'>
              {t.functions}
            </label>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
              {t.functionsHelp}
            </p>
            <div className="space-y-1">
              {functions.map((fn, index) => (
                <div key={fn.id}>
                  <div
                    className={`flex items-center gap-1 rounded p-0.5 ${
                      index === selectedFunctionIndex ? 'bg-blue-50 ring-1 ring-blue-400 dark:bg-blue-900/40 dark:ring-blue-700' : ''
                    }`}
                  >
                    <button
                      onClick={() => setColorEditorFunctionId(id => (id === fn.id ? null : fn.id))}
                      className="w-6 h-6 rounded shrink-0 border border-black/20 dark:border-white/30"
                      style={{ backgroundColor: fn.color }}
                      title={t.functionColor}
                      aria-label={t.colorOf(fn.text)}
                    />
                    <input
                      ref={(el) => { functionInputRefs.current[index] = el; }}
                      type="text"
                      value={fn.text}
                      placeholder={t.functionPlaceholder}
                      onChange={(e) => onUpdatePin(renamePinFunction(selectedPin, index, e.target.value), fieldSession.next())}
                      onFocus={() => handleFunctionFocus(index)}
                      onBlur={fieldSession.end}
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      onClick={() => handleMoveFunction(index, -1)}
                      disabled={index === 0}
                      className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 text-xs px-1"
                      title={t.moveCloser}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveFunction(index, 1)}
                      disabled={index === functions.length - 1}
                      className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 disabled:opacity-30 text-xs px-1"
                      title={t.moveFurther}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveFunction(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1"
                      title={t.removeFunction}
                    >
                      ✕
                    </button>
                  </div>
                  {colorEditorFunctionId === fn.id && (
                    <div className="py-2 pl-1">
                      <ColorPalette
                        value={fn.color}
                        onChange={(color, saveHistory) => onUpdatePin(updatePinFunction(selectedPin, index, { color }), saveHistory)}
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddFunction}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-1 font-medium"
              >
                {t.addFunction}
              </button>
            </div>
          </div>

          <hr className="my-4 border-gray-300 dark:border-gray-600" />

          <div>
            <label className='block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2'>
              {t.positionAdjustment}
            </label>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.step}</span>
              <input
                type="number"
                min="1"
                max="100"
                value={customStep}
                onChange={(e) => setCustomStep(Number(e.target.value) || 1)}
                className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">px</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div></div>
              <button
                onClick={() => handleMoveUp(customStep)}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1 px-2 rounded text-xs font-bold"
                title={t.moveUp(customStep)}
              >
                ↑
              </button>
              <div></div>

              <button
                onClick={() => handleMoveLeft(customStep)}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1 px-2 rounded text-xs font-bold"
                title={t.moveLeft(customStep)}
              >
                ←
              </button>
              <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                {customStep}px
              </div>
              <button
                onClick={() => handleMoveRight(customStep)}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1 px-2 rounded text-xs font-bold"
                title={t.moveRight(customStep)}
              >
                →
              </button>

              <div></div>
              <button
                onClick={() => handleMoveDown(customStep)}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-1 px-2 rounded text-xs font-bold"
                title={t.moveDown(customStep)}
              >
                ↓
              </button>
              <div></div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.positionHelp}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
