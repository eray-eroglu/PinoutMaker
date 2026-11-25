import { defineMessages, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    title: 'Keyboard shortcuts',
    arrowKeys: 'Arrow keys',
    altArrowKeys: 'Alt + Arrow keys',
    shiftCtrlClick: 'Shift / Ctrl + click',
    shiftDrag: 'Shift + drag',
    altDragLabel: 'Alt + drag label',
    shiftAddHeader: 'Shift (Add Header)',
    nudge: 'Nudge selection 1 px (Shift: 10 px)',
    movePin: 'Move whole pin (label and anchor)',
    toggleSelection: 'Add / remove a pin from the selection',
    areaSelect: 'Select pins in an area (on empty canvas or the board)',
    selectAll: 'Select all pins',
    moveWholePins: 'Move whole pins (labels and anchors); or tick "Move anchors too" in the sidebar',
    duplicate: 'Duplicate selected pins or line',
    copyPaste: 'Copy / paste selected pins or line',
    deleteSelection: 'Delete selection',
    undoRedo: 'Undo / redo',
    save: 'Save',
    fit: 'Fit to screen',
    resetZoom: 'Reset zoom to 100%',
    zoomInOut: 'Zoom in / out',
    headerStraight: 'Keep the header straight while picking the last pad',
    applyPinTable: 'Apply the pin table',
    escape: 'Close the open panel; else clear selection, cancel drawing / header',
    toggleHelp: 'Show / hide this help',
  },
  tr: {
    title: 'Klavye kısayolları',
    arrowKeys: 'Ok tuşları',
    altArrowKeys: 'Alt + Ok tuşları',
    shiftCtrlClick: 'Shift / Ctrl + tıklama',
    shiftDrag: 'Shift + sürükleme',
    altDragLabel: 'Alt + etiketi sürükleme',
    shiftAddHeader: 'Shift (Header ekle)',
    nudge: 'Seçimi 1 px kaydır (Shift: 10 px)',
    movePin: 'Pinin tamamını taşı (etiket ve bağlantı noktası)',
    toggleSelection: 'Seçime pin ekle / seçimden çıkar',
    areaSelect: 'Bir alandaki pinleri seç (boş tuvalde veya kartta)',
    selectAll: 'Tüm pinleri seç',
    moveWholePins: 'Pinlerin tamamını taşı (etiketler ve bağlantı noktaları); ya da kenar çubuğunda "Bağlantı noktalarını da taşı" seçeneğini işaretleyin',
    duplicate: 'Seçili pinleri veya çizgiyi çoğalt',
    copyPaste: 'Seçili pinleri veya çizgiyi kopyala / yapıştır',
    deleteSelection: 'Seçimi sil',
    undoRedo: 'Geri al / yinele',
    save: 'Kaydet',
    fit: 'Ekrana sığdır',
    resetZoom: 'Yakınlaştırmayı %100’e sıfırla',
    zoomInOut: 'Yakınlaştır / uzaklaştır',
    headerStraight: 'Son padi seçerken header’ı düz tut',
    applyPinTable: 'Pin tablosunu uygula',
    escape: 'Açık paneli kapat; yoksa seçimi temizle, çizimi / header’ı iptal et',
    toggleHelp: 'Bu yardımı göster / gizle',
  },
});

type Text = keyof typeof MESSAGES.en;

// Keys are either literal key names (not translated) or a message key
const SHORTCUTS: Array<[{ text: Text } | string, Text]> = [
  [{ text: 'arrowKeys' }, 'nudge'],
  [{ text: 'altArrowKeys' }, 'movePin'],
  [{ text: 'shiftCtrlClick' }, 'toggleSelection'],
  [{ text: 'shiftDrag' }, 'areaSelect'],
  ['Ctrl + A', 'selectAll'],
  [{ text: 'altDragLabel' }, 'moveWholePins'],
  ['Ctrl + D', 'duplicate'],
  ['Ctrl + C / Ctrl + V', 'copyPaste'],
  ['Del / Backspace', 'deleteSelection'],
  ['Ctrl + Z / Ctrl + Y', 'undoRedo'],
  ['Ctrl + S', 'save'],
  ['Shift + 1', 'fit'],
  ['Ctrl + 0', 'resetZoom'],
  ['Ctrl + = / Ctrl + -', 'zoomInOut'],
  [{ text: 'shiftAddHeader' }, 'headerStraight'],
  ['Ctrl + Enter', 'applyPinTable'],
  ['Esc', 'escape'],
  ['?', 'toggleHelp'],
];

export const ShortcutsHelp = ({ onClose }: { onClose: () => void }) => {
  const t = useMessages(MESSAGES);
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30' onClick={onClose}>
      <div
        role='dialog'
        aria-label={t.title}
        className='bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 w-96 max-w-[90vw]'
        onClick={e => e.stopPropagation()}
      >
        <h2 className='text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>{t.title}</h2>
        <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs'>
          {SHORTCUTS.map(([keys, action]) => {
            const keyText = typeof keys === 'string' ? keys : t[keys.text];
            return (
              <div key={action} className='contents'>
                <dt className='font-mono text-gray-800 dark:text-gray-100 whitespace-nowrap'>{keyText}</dt>
                <dd className='text-gray-600 dark:text-gray-400'>{t[action]}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
};
