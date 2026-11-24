import { History } from 'lucide-react';
import { formatRelativeTime } from '../utils/autosave';

interface RestoreBannerProps {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

/** Non-blocking notice shown over the canvas when an autosaved project was found at startup. */
export const RestoreBanner = ({ savedAt, onRestore, onDiscard }: RestoreBannerProps) => (
  <div
    role='status'
    className='absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-lg'
  >
    <History size={18} className='shrink-0 text-blue-600' />
    <span>Unsaved work from {formatRelativeTime(savedAt)} was found.</span>
    <button
      onClick={onRestore}
      className='rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 cursor-pointer'
    >
      Restore
    </button>
    <button
      onClick={onDiscard}
      className='rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100 cursor-pointer'
    >
      Discard
    </button>
  </div>
);
