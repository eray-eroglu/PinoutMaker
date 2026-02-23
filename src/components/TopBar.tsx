import { useRef } from 'react';
import { Save, Upload, Plus, Trash2, RotateCw, FileDown, FolderOpen } from 'lucide-react';

interface TopBarProps {
  onImport: (file: File) => void;
  onAddPin: () => void;
  onDeletePin: () => void;
  onRotateImage: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportPdf: () => void;
  isPinSelected: boolean;
  isImageLoaded: boolean;
  isAddingPin: boolean;
}

export const TopBar = ({ 
  onImport, 
  onAddPin, 
  onDeletePin, 
  onRotateImage,
  onSave,
  onLoad,
  onExportPdf,
  isPinSelected,
  isImageLoaded,
  isAddingPin
}: TopBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className='h-14 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-4 shrink-0'>
      <input
        type='file'
        ref={fileInputRef}
        className='hidden'
        accept='image/*'
        onChange={handleFileChange}
      />
      <button 
        onClick={onSave}
        className='flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm cursor-pointer transition-colors'
      >
        <Save size={16} /> Save
      </button>

      <button 
        onClick={onLoad}
        className='flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <FolderOpen size={16} /> Load
      </button>

      <button 
        onClick={handleImportClick}
        className='flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <Upload size={16} /> Import
      </button>

      <button
        onClick={onRotateImage}
        disabled={!isImageLoaded}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${
          isImageLoaded
          ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 cursor-pointer'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <RotateCw size={16} /> Rotate
      </button>

      <button
        onClick={onExportPdf}
        className='flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <FileDown size={16} /> Export PDF
      </button>

      <div className='w-px h-6 bg-gray-300 mx-2'></div>

      <button
        onClick={onAddPin}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${
          isAddingPin
            ? 'bg-blue-100 border-blue-300 text-blue-700'
            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
        }`}
      >
        <Plus size={16} /> {isAddingPin ? 'Click on Board' : 'Add Pin'}
      </button>
      <button
        onClick={onDeletePin}
        disabled={!isPinSelected}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ml-auto ${
          isPinSelected
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer'
            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <Trash2 size={16} /> Delete Pin
      </button>
    </div>
  );
};
