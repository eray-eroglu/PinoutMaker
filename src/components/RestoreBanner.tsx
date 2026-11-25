import { History } from 'lucide-react';
import { formatRelativeTime } from '../utils/autosave';
import { defineMessages, useLanguage, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    found: (when: string) => `Unsaved work from ${when} was found.`,
    restore: 'Restore',
    discard: 'Discard',
  },
  tr: {
    found: (when: string) => `Kaydedilmemiş bir çalışma bulundu (${when}).`,
    restore: 'Geri yükle',
    discard: 'Yok say',
  },
});

interface RestoreBannerProps {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

/** Non-blocking notice shown over the canvas when an autosaved project was found at startup. */
export const RestoreBanner = ({ savedAt, onRestore, onDiscard }: RestoreBannerProps) => {
  const t = useMessages(MESSAGES);
  const { language } = useLanguage();
  return (
    <div
      role='status'
      className='absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 shadow-lg'
    >
      <History size={18} className='shrink-0 text-blue-600 dark:text-blue-400' />
      <span>{t.found(formatRelativeTime(savedAt, undefined, language))}</span>
      <button
        onClick={onRestore}
        className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer'
      >
        {t.restore}
      </button>
      <button
        onClick={onDiscard}
        className='rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
      >
        {t.discard}
      </button>
    </div>
  );
};
