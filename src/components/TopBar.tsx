import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Save, Upload, Plus, Spline, Trash2, RotateCw, FolderOpen, BookOpen, GripVertical, ClipboardPaste, Keyboard, Languages, Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { defineMessages, useLanguage, useMessages } from '../i18n';
import { nextThemeSetting, useTheme } from '../theme';
import { ExportMenu } from './ExportMenu';
import { StableLabel } from './StableLabel';
import type { ExportOptions } from '../utils/export';
import type { ThemeSetting } from '../theme';

const MESSAGES = defineMessages({
  en: {
    save: 'Save',
    saveTip: 'Save your current board layout and pins to a file (Ctrl+S)',
    load: 'Load',
    loadTip: 'Load a previously saved project file (.json)',
    import: 'Import',
    importTip: 'Import a new image to the board. You can add multiple images.',
    rotate: 'Rotate',
    rotateTip: 'Rotate the currently selected image 90 degrees clockwise',
    library: 'Boardoza Library',
    libraryTip: 'Open/Close Boardoza Image Library',
    drawLine: 'Draw Line',
    drawLineTip: 'Draw a free free-moving line with a start and end point',
    addPin: 'Add Pin',
    addPinTip: 'Add a new customizable pin to the board',
    addHeader: 'Add Header',
    addHeaderTip: 'Place a whole row of pins: click the first pad, then the last (Shift keeps it straight)',
    pinTable: 'Pin table…',
    pinTableTip: 'Fill a header from a table pasted from a datasheet, Excel or CSV',
    pinTableDisabledTip: 'Add a header first, then fill it from a pasted table',
    switchLanguage: 'Switch to Turkish (Türkçe)',
    theme: (setting: ThemeSetting) => `Theme: ${{ light: 'Light', dark: 'Dark', system: 'System' }[setting]}`,
    shortcutsLabel: 'Keyboard shortcuts',
    shortcuts: 'Shortcuts',
    shortcutsTip: 'Show all keyboard shortcuts (?)',
    delete: 'Delete',
    deleteTip: 'Delete the currently selected pin or image (Del)',
  },
  tr: {
    save: 'Kaydet',
    saveTip: 'Mevcut kart düzenini ve pinleri bir dosyaya kaydet (Ctrl+S)',
    load: 'Aç',
    loadTip: 'Daha önce kaydedilmiş bir proje dosyasını aç (.json)',
    import: 'İçe aktar',
    importTip: 'Tuvale yeni bir görsel aktar. Birden fazla görsel ekleyebilirsiniz.',
    rotate: 'Döndür',
    rotateTip: 'Seçili görseli saat yönünde 90 derece döndür',
    library: 'Boardoza Kütüphanesi',
    libraryTip: 'Boardoza görsel kütüphanesini aç/kapat',
    drawLine: 'Çizgi çiz',
    drawLineTip: 'Başlangıç ve bitiş noktası olan, serbestçe taşınabilen bir çizgi çiz',
    addPin: 'Pin ekle',
    addPinTip: 'Karta özelleştirilebilir yeni bir pin ekle',
    addHeader: 'Header ekle',
    addHeaderTip: 'Bir sıra pini tek seferde yerleştir: önce ilk pade, sonra son pade tıklayın (Shift düz tutar)',
    pinTable: 'Pin tablosu…',
    pinTableTip: 'Bir header’ı datasheet, Excel veya CSV’den yapıştırılan bir tabloyla doldur',
    pinTableDisabledTip: 'Önce bir header ekleyin, sonra yapıştırılan bir tabloyla doldurun',
    switchLanguage: 'İngilizceye geç (English)',
    theme: (setting: ThemeSetting) => `Tema: ${{ light: 'Açık', dark: 'Koyu', system: 'Sistem' }[setting]}`,
    shortcutsLabel: 'Klavye kısayolları',
    shortcuts: 'Kısayollar',
    shortcutsTip: 'Tüm klavye kısayollarını göster (?)',
    delete: 'Sil',
    deleteTip: 'Seçili pini veya görseli sil (Del)',
  },
});

type MessageKey = { [K in keyof typeof MESSAGES.en]: (typeof MESSAGES.en)[K] extends string ? K : never }[keyof typeof MESSAGES.en];

/** A label's texts in every language, so StableLabel can reserve the widest one. */
const inAllLanguages = (...keys: MessageKey[]): string[] => keys.flatMap(key => [MESSAGES.en[key], MESSAGES.tr[key]]);

/**
 * From which window width each label is shown; narrower, its button shows only the icon (the label
 * stays its accessible name and the hover tooltip still explains it). Every label reserves its
 * widest language (StableLabel), so the toolbar is as wide in English as in Turkish. Measured
 * toolbar widths (Segoe UI 14px): all labels ~1700px; up to 2xl ~1440px; up to xl ~1200px;
 * Save and Export only ~890px; icons only ~760px. Narrower than that, the toolbar scrolls sideways.
 */
const SHOW_FROM = {
  lg: 'hidden lg:inline',
  xl: 'hidden xl:inline',
  '2xl': 'hidden 2xl:inline',
  wide: 'hidden min-[1800px]:inline',
} as const;

const NEUTRAL = 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 cursor-pointer';
const ACTIVE = 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300 cursor-pointer';
const DISABLED = 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500';

const TOOLTIP_GAP = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Pins a tooltip under its button with position:fixed, so the toolbar's horizontal scroll can't
 * clip it, and keeps it inside the window. Until the first hover it stays absolutely positioned.
 */
const placeTooltip = (anchor: HTMLElement, tip: HTMLElement) => {
  const rect = anchor.getBoundingClientRect();
  const maxLeft = document.documentElement.clientWidth - tip.offsetWidth - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left + rect.width / 2 - tip.offsetWidth / 2, maxLeft));
  // The fallback classes centre the tooltip with Tailwind's -translate-x-1/2 (the CSS `translate`
  // property, not `transform`) and space it with mt-2; both must be cancelled, or the tooltip ends up
  // half its width to the left (off the window for the leftmost buttons) and 8 px too low.
  Object.assign(tip.style, {
    position: 'fixed',
    top: `${rect.bottom + TOOLTIP_GAP}px`,
    left: `${left}px`,
    right: 'auto',
    translate: 'none',
    transform: 'none',
    margin: '0',
  });
};

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  /** The label in every language (StableLabel keeps room for the widest). */
  variants: string[];
  /** When the label is shown (a SHOW_FROM entry); below that the button is icon-only. */
  labelClassName: string;
  tooltip: ReactNode;
  /** Colour and state classes. */
  className: string;
  onClick: () => void;
  disabled?: boolean;
  /** Ends the fallback tooltip at the button's right edge (buttons on the window's right side). */
  tooltipAtEnd?: boolean;
  /** Accessible name when it should differ from the visible label. */
  ariaLabel?: string;
}

const ToolButton = ({ icon: Icon, label, variants, labelClassName, tooltip, className, onClick, disabled, tooltipAtEnd, ariaLabel }: ToolButtonProps) => {
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLDivElement>(null);
  return (
    // The wrapper takes the hover so the tooltip also explains a disabled button
    <div
      className='group relative flex shrink-0'
      onPointerEnter={e => {
        if (tooltipRef.current) placeTooltip(e.currentTarget, tooltipRef.current);
      }}
    >
      <button
        type='button'
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        aria-describedby={tooltipId}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${className}`}
      >
        <Icon size={16} />
        <span className={labelClassName}>
          <StableLabel text={label} variants={variants} />
        </span>
      </button>
      <div
        ref={tooltipRef}
        id={tooltipId}
        role='tooltip'
        className={`absolute top-full mt-2 ${tooltipAtEnd ? 'right-0' : 'left-1/2 -translate-x-1/2'} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-[opacity,visibility] duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md`}
      >
        {tooltip}
      </div>
    </div>
  );
};

interface TopBarProps {
  onImport: (file: File) => void;
  onAddPin: () => void;
  onDeletePin: () => void;
  onRotateImage: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: (options: ExportOptions) => void;
  /** Default for the export menu's "Include legend" option. */
  isLegendVisible: boolean;
  isPinSelected: boolean;
  isImageLoaded: boolean;
  isAddingPin: boolean;
  onAddLine: () => void;
  isAddingLine: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  /** Header tool: place a whole row of pins from its first and last pad. */
  onAddHeader?: () => void;
  isAddingHeader?: boolean;
  /** Opens the pin table dialog; only useful once a header exists. */
  onOpenPinTable?: () => void;
  hasHeaders?: boolean;
  onExportMenuOpenChange?: (isOpen: boolean) => void;
  /** Downloads the pin list as CSV (entry in the export menu). */
  onExportPinList?: () => void;
  hasPins?: boolean;
  /** Opens the keyboard shortcuts overlay (also on the ? key). */
  onShowShortcuts?: () => void;
}

export const TopBar = ({
  onImport,
  onAddPin,
  onDeletePin,
  onRotateImage,
  onSave,
  onLoad,
  onExport,
  isLegendVisible,
  isPinSelected,
  isImageLoaded,
  isAddingPin,
  onAddLine,
  isAddingLine,
  onToggleLibrary,
  isLibraryOpen,
  onAddHeader,
  isAddingHeader = false,
  onOpenPinTable,
  hasHeaders = false,
  onExportMenuOpenChange,
  onExportPinList,
  hasPins,
  onShowShortcuts,
}: TopBarProps) => {
  const t = useMessages(MESSAGES);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage } = useLanguage();
  const { setting: themeSetting, setSetting: setThemeSetting } = useTheme();
  const ThemeIcon = themeSetting === 'light' ? Sun : themeSetting === 'dark' ? Moon : Monitor;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    // Reset value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className='h-14 bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 flex items-center px-2 lg:px-4 gap-2 xl:gap-3 min-[1800px]:gap-4 shrink-0 overflow-x-auto [scrollbar-width:thin]'>
      <input
        type='file'
        ref={fileInputRef}
        className='hidden'
        accept='image/*'
        onChange={handleFileChange}
      />
      <ToolButton
        icon={Save}
        label={t.save}
        variants={inAllLanguages('save')}
        labelClassName={SHOW_FROM.lg}
        tooltip={t.saveTip}
        onClick={onSave}
        className='bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
      />
      <ToolButton
        icon={FolderOpen}
        label={t.load}
        variants={inAllLanguages('load')}
        labelClassName={SHOW_FROM['2xl']}
        tooltip={t.loadTip}
        onClick={onLoad}
        className={`border ${NEUTRAL}`}
      />
      <ToolButton
        icon={Upload}
        label={t.import}
        variants={inAllLanguages('import')}
        labelClassName={SHOW_FROM['2xl']}
        tooltip={t.importTip}
        onClick={handleImportClick}
        className={`border ${NEUTRAL}`}
      />
      <ToolButton
        icon={RotateCw}
        label={t.rotate}
        variants={inAllLanguages('rotate')}
        labelClassName={SHOW_FROM['2xl']}
        tooltip={t.rotateTip}
        onClick={onRotateImage}
        disabled={!isImageLoaded}
        className={`border ${isImageLoaded ? NEUTRAL : DISABLED}`}
      />

      <ExportMenu
        onExport={onExport}
        isLegendVisible={isLegendVisible}
        onOpenChange={onExportMenuOpenChange}
        onExportPinList={onExportPinList}
        hasPins={hasPins}
        labelClassName={SHOW_FROM.lg}
      />

      <ToolButton
        icon={BookOpen}
        label={t.library}
        variants={inAllLanguages('library')}
        labelClassName={SHOW_FROM.wide}
        tooltip={t.libraryTip}
        onClick={onToggleLibrary}
        className={`border ${isLibraryOpen
          ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300 cursor-pointer'
          : NEUTRAL
          }`}
      />

      <div className='w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 lg:mx-2 shrink-0'></div>

      <ToolButton
        icon={Spline}
        label={t.drawLine}
        variants={inAllLanguages('drawLine')}
        labelClassName={SHOW_FROM.xl}
        tooltip={t.drawLineTip}
        onClick={onAddLine}
        className={`border ${isAddingLine ? ACTIVE : NEUTRAL}`}
      />
      <ToolButton
        icon={Plus}
        label={t.addPin}
        variants={inAllLanguages('addPin')}
        labelClassName={SHOW_FROM.xl}
        tooltip={t.addPinTip}
        onClick={onAddPin}
        className={`border ${isAddingPin ? ACTIVE : NEUTRAL}`}
      />
      {onAddHeader && (
        <ToolButton
          icon={GripVertical}
          label={t.addHeader}
          variants={inAllLanguages('addHeader')}
          labelClassName={SHOW_FROM.xl}
          tooltip={t.addHeaderTip}
          onClick={onAddHeader}
          className={`border ${isAddingHeader ? ACTIVE : NEUTRAL}`}
        />
      )}
      {onOpenPinTable && (
        <ToolButton
          icon={ClipboardPaste}
          label={t.pinTable}
          variants={inAllLanguages('pinTable')}
          labelClassName={SHOW_FROM['2xl']}
          tooltip={hasHeaders ? t.pinTableTip : t.pinTableDisabledTip}
          onClick={onOpenPinTable}
          disabled={!hasHeaders}
          className={`border ${hasHeaders ? NEUTRAL : DISABLED}`}
        />
      )}
      <div className='ml-auto flex items-center gap-2 xl:gap-3 min-[1800px]:gap-4 shrink-0'>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
            aria-label={t.switchLanguage}
            title={t.switchLanguage}
            className='flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 text-sm font-medium cursor-pointer transition-colors'
          >
            <Languages size={16} /> <StableLabel text={language.toUpperCase()} variants={['EN', 'TR']} />
          </button>
          <button
            type='button'
            onClick={() => setThemeSetting(nextThemeSetting(themeSetting))}
            aria-label={t.theme(themeSetting)}
            title={t.theme(themeSetting)}
            className='flex items-center px-2 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 cursor-pointer transition-colors'
          >
            <ThemeIcon size={16} />
          </button>
        </div>
        {onShowShortcuts && (
          <ToolButton
            icon={Keyboard}
            label={t.shortcuts}
            ariaLabel={t.shortcutsLabel}
            variants={inAllLanguages('shortcuts')}
            labelClassName={SHOW_FROM.wide}
            tooltip={t.shortcutsTip}
            onClick={onShowShortcuts}
            tooltipAtEnd
            className={`border ${NEUTRAL}`}
          />
        )}
        <ToolButton
          icon={Trash2}
          label={t.delete}
          variants={inAllLanguages('delete')}
          labelClassName={SHOW_FROM.xl}
          tooltip={t.deleteTip}
          onClick={onDeletePin}
          disabled={!isPinSelected}
          tooltipAtEnd
          className={`border ${isPinSelected
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40'
            : DISABLED
            }`}
        />
      </div>
    </div>
  );
};
