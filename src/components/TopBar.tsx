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
  onAddLine: () => void;
  isAddingLine: boolean;
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
  isAddingPin,
  onAddLine,
  isAddingLine
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
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm cursor-pointer transition-colors'
      >
        <Save size={16} /> Save
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Save your current board layout and pins to a file (Ctrl+S)
        </div>
      </button>

      <button
        onClick={onLoad}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <FolderOpen size={16} /> Load
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Load a previously saved project file (.json)
        </div>
      </button>

      <button
        onClick={handleImportClick}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <Upload size={16} /> Import
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Import a new image to the board. You can add multiple images.
        </div>
      </button>

      <button
        onClick={onRotateImage}
        disabled={!isImageLoaded}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${isImageLoaded
          ? 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 cursor-pointer'
          : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
      >
        <RotateCw size={16} /> Rotate
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Rotate the currently selected image 90 degrees clockwise
        </div>
      </button>

      <button
        onClick={onExportPdf}
        className='group relative flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 text-sm cursor-pointer transition-colors'
      >
        <FileDown size={16} /> Export PDF
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Export your board and pin table as a high-quality PDF
        </div>
      </button>

      <div className='w-px h-6 bg-gray-300 mx-2'></div>

      <button
        onClick={onAddLine}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isAddingLine
          ? 'bg-blue-100 border-blue-300 text-blue-700'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
          }`}
      >
        <Plus size={16} /> {isAddingLine ? 'Click on Board' : 'Draw Line'}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Draw a free free-moving line with a start and end point
        </div>
      </button>

      <button
        onClick={onAddPin}
        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded text-sm cursor-pointer transition-colors ${isAddingPin
          ? 'bg-blue-100 border-blue-300 text-blue-700'
          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
          }`}
      >
        <Plus size={16} /> {isAddingPin ? 'Click on Board' : 'Add Pin'}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Add a new customizable pin to the board
        </div>
      </button>
      <div className={`group relative flex ml-auto`}>
        <button
          onClick={onDeletePin}
          disabled={!isPinSelected}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm transition-colors ${isPinSelected
            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer'
            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          <Trash2 size={16} /> {isPinSelected ? 'Delete' : 'Delete Pin'}
        </button>
        <div className="absolute top-full mt-2 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-500 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 whitespace-nowrap shadow-md">
          Delete the currently selected pin or image (Del)
        </div>
      </div>
    </div>
  );
};
