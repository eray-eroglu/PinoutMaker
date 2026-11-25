import { useRef } from 'react';
import { Save, Upload, Plus, Trash2, RotateCw, FolderOpen, BookOpen, GripVertical, ClipboardPaste, Keyboard, Languages, Sun, Moon, Monitor } from 'lucide-react';
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
    <div className='h-14 bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 flex items-center px-4 gap-4 shrink-0'>
      <input
        type='file'
        ref={fileInputRef}
        className='hidden'
        accept='image/*'
        onChange={handleFileChange}
      />
      <button
        onClick={onSave}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm cursor-pointer transition-colors'
      >
        <Save size={16} /> <StableLabel text={t.save} variants={inAllLanguages('save')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.saveTip}
        </div>
      </button>

      <button
        onClick={onLoad}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 text-sm cursor-pointer transition-colors'
      >
        <FolderOpen size={16} /> <StableLabel text={t.load} variants={inAllLanguages('load')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.loadTip}
        </div>
      </button>

      <button
        onClick={handleImportClick}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 text-sm cursor-pointer transition-colors'
      >
        <Upload size={16} /> <StableLabel text={t.import} variants={inAllLanguages('import')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.importTip}
        </div>
      </button>

      <button
        onClick={onRotateImage}
        disabled={!isImageLoaded}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${isImageLoaded
          ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 cursor-pointer'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500'
          }`}
      >
        <RotateCw size={16} /> <StableLabel text={t.rotate} variants={inAllLanguages('rotate')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.rotateTip}
        </div>
      </button>

      <ExportMenu onExport={onExport} isLegendVisible={isLegendVisible} onOpenChange={onExportMenuOpenChange} />

      <button
        onClick={onToggleLibrary}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isLibraryOpen
          ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
          }`}
      >
<BookOpen size={16} /> <StableLabel text={t.library} variants={inAllLanguages('library')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.libraryTip}
        </div>
      </button>

      <div className='w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2'></div>

      <button
        onClick={onAddLine}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isAddingLine
          ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
          }`}
      >
        <Plus size={16} /> <StableLabel text={t.drawLine} variants={inAllLanguages('drawLine')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.drawLineTip}
        </div>
      </button>

      <button
        onClick={onAddPin}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isAddingPin
          ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
          }`}
      >
        <Plus size={16} /> <StableLabel text={t.addPin} variants={inAllLanguages('addPin')} />
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.addPinTip}
        </div>
      </button>

      {onAddHeader && (
        <button
          onClick={onAddHeader}
          className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isAddingHeader
            ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200'
            }`}
        >
          <GripVertical size={16} /> <StableLabel text={t.addHeader} variants={inAllLanguages('addHeader')} />
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
            {t.addHeaderTip}
          </div>
        </button>
      )}

      {onOpenPinTable && (
        <button
          onClick={onOpenPinTable}
          disabled={!hasHeaders}
          className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${hasHeaders
            ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 cursor-pointer'
            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500'
            }`}
        >
          <ClipboardPaste size={16} /> <StableLabel text={t.pinTable} variants={inAllLanguages('pinTable')} />
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
            {hasHeaders ? t.pinTableTip : t.pinTableDisabledTip}
          </div>
        </button>
      )}
      <div className='ml-auto flex items-center gap-4'>
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
        <button
          type='button'
          onClick={onShowShortcuts}
          aria-label={t.shortcutsLabel}
          className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200 text-sm cursor-pointer transition-colors'
        >
          <Keyboard size={16} /> <StableLabel text={t.shortcuts} variants={inAllLanguages('shortcuts')} />
          <div className="absolute top-full mt-2 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
            {t.shortcutsTip}
          </div>
        </button>
      )}
      <div className='group relative flex'>
        <button
          onClick={onDeletePin}
          disabled={!isPinSelected}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${isPinSelected
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/40'
            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500'
            }`}
        >
          <Trash2 size={16} /> <StableLabel text={t.delete} variants={inAllLanguages('delete')} />
        </button>
        <div className="absolute top-full mt-2 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          {t.deleteTip}
        </div>
      </div>
      </div>
    </div>
  );
};
