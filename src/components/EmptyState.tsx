import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { BookOpen, FolderOpen, ImagePlus, Upload } from 'lucide-react';
import { defineMessages, useMessages } from '../i18n';

const MESSAGES = defineMessages({
  en: {
    title: 'Start your pinout',
    intro: 'Bring in a board photo, then place pins and labels on it.',
    importTitle: 'Import an image',
    importText: 'A photo or render of your board. You can also drop it here.',
    libraryTitle: 'Boardoza Library',
    libraryText: 'Start from a ready-made board, with or without its pinout.',
    openTitle: 'Open a project',
    openText: 'Continue a pinout saved as a .json file.',
    dropHere: 'Drop the image to start',
    hintPins: 'Then place pins with “Add Pin” or “Add Header”',
    hintShortcuts: 'Press ? for keyboard shortcuts',
  },
  tr: {
    title: 'Pinout çizimine başlayın',
    intro: 'Kartın bir fotoğrafını ekleyin, ardından üzerine pinleri ve etiketleri yerleştirin.',
    importTitle: 'Görsel içe aktar',
    importText: 'Kartın fotoğrafı ya da çizimi. Dosyayı buraya sürükleyip bırakabilirsiniz.',
    libraryTitle: 'Boardoza Kütüphanesi',
    libraryText: 'Hazır bir kartla başlayın; isterseniz pinout’uyla birlikte.',
    openTitle: 'Proje aç',
    openText: '.json olarak kaydettiğiniz bir pinout’a devam edin.',
    dropHere: 'Başlamak için görseli bırakın',
    hintPins: 'Ardından pinleri “Pin ekle” ya da “Header ekle” ile yerleştirin',
    hintShortcuts: 'Klavye kısayolları için ? tuşuna basın',
  },
});

interface EmptyStateProps {
  /** Called with the chosen or dropped image file. */
  onImportImage: (file: File) => void;
  /** Opens the Boardoza product library; the card is hidden when not given. */
  onOpenLibrary?: () => void;
  /** Opens a saved .json project. */
  onLoadProject: () => void;
}

const isImageFile = (file: File) => file.type.startsWith('image/');

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

interface OptionCardProps {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  primary?: boolean;
}

const OptionCard = ({ icon, title, text, onClick, primary }: OptionCardProps) => (
  <button
    type='button'
    onClick={onClick}
    className={`group flex flex-1 flex-col items-start gap-2 rounded-lg border p-4 text-left cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      primary
        ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
    }`}
  >
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-full ${
        primary
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 group-hover:text-blue-600 dark:bg-gray-800 dark:text-gray-300 dark:group-hover:text-blue-400'
      }`}
      aria-hidden='true'
    >
      {icon}
    </span>
    <span className='font-semibold text-gray-900 dark:text-gray-100'>{title}</span>
    <span className='text-xs leading-snug text-gray-500 dark:text-gray-400'>{text}</span>
  </button>
);

/**
 * Welcome panel shown over the canvas while the project is empty: the ways to start (image,
 * library, saved project) plus a drop target for an image dragged in from the desktop.
 * Only the card takes pointer events, so the canvas around it stays usable.
 */
export const EmptyState = ({ onImportImage, onOpenLibrary, onLoadProject }: EmptyStateProps) => {
  const t = useMessages(MESSAGES);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // dragenter/dragleave also fire for children; count them so the highlight does not flicker
  const dragDepth = useRef(0);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportImage(file);
    // Reset so the same file can be chosen again
    e.target.value = '';
  };

  const handleDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    const image = Array.from(e.dataTransfer?.files ?? []).find(isImageFile);
    if (image) onImportImage(image);
  };

  return (
    <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4'>
      <section
        aria-labelledby='empty-state-title'
        data-testid='empty-state'
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`pointer-events-auto relative w-full max-w-2xl rounded-xl border-2 bg-white p-6 shadow-xl transition-colors dark:bg-gray-900 ${
          isDragOver
            ? 'border-dashed border-blue-500 dark:border-blue-400'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <input
          type='file'
          ref={fileInputRef}
          onChange={handleFileChange}
          accept='image/*'
          className='hidden'
          data-testid='empty-state-file-input'
        />
        <h2 id='empty-state-title' className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
          {t.title}
        </h2>
        <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>{t.intro}</p>

        <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
          <OptionCard
            primary
            icon={<ImagePlus size={20} />}
            title={t.importTitle}
            text={t.importText}
            onClick={() => fileInputRef.current?.click()}
          />
          {onOpenLibrary && (
            <OptionCard
              icon={<BookOpen size={20} />}
              title={t.libraryTitle}
              text={t.libraryText}
              onClick={onOpenLibrary}
            />
          )}
          <OptionCard icon={<FolderOpen size={20} />} title={t.openTitle} text={t.openText} onClick={onLoadProject} />
        </div>

        <ul className='mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400'>
          <li>{t.hintPins}</li>
          <li>{t.hintShortcuts}</li>
        </ul>

        {isDragOver && (
          <div
            role='status'
            className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-blue-50/95 text-blue-700 dark:bg-gray-900/95 dark:text-blue-300'
          >
            <Upload size={32} aria-hidden='true' />
            <span className='text-base font-semibold'>{t.dropHere}</span>
          </div>
        )}
      </section>
    </div>
  );
};
