import { useState, useRef, useEffect } from 'react';
import type { PinData, LineData, LegendItem } from '../types';
import type { LoadedImage } from '../utils/project';
import { isLightColor } from '../utils/colorUtils';
import { getColorForRename, nudgeLabel } from '../utils/pinUtils';

interface SidebarProps {
  selectedPin: PinData | null;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  selectedImage: LoadedImage | null;
  onUpdateImage: (img: LoadedImage, saveHistory?: boolean) => void;
  selectedLine: LineData | null;
  onUpdateLine: (line: LineData, saveHistory?: boolean) => void;
  onPushHistory: () => void;
  /** Downloads the pins/lines relative to the selected image as a Boardoza library pinout (JSON). */
  onExportPinoutTemplate: () => void;
  gapSize: number;
  onGapSizeChange: (size: number) => void;
  legendItems: LegendItem[];
  onLegendItemsChange: (items: LegendItem[]) => void;
  isLegendVisible: boolean;
  onLegendVisibilityChange: (visible: boolean) => void;
  anchorSize: number;
  onAnchorSizeChange: (size: number) => void;
  /** World size of one label unit. */
  labelScale: number;
  onLabelScaleChange: (labelScale: number) => void;
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

export const Sidebar = ({
  selectedPin, onUpdatePin, selectedImage, onUpdateImage, 
  selectedLine, onUpdateLine,
  onPushHistory, onExportPinoutTemplate, gapSize, onGapSizeChange,
  legendItems, onLegendItemsChange, isLegendVisible, onLegendVisibilityChange, anchorSize, onAnchorSizeChange,
  labelScale, onLabelScaleChange,
}: SidebarProps) => {
  const [customStep, setCustomStep] = useState<number>(5);
  const [isTableSettingsExpanded, setIsTableSettingsExpanded] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocus = () => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
      }
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
      }, false);
    }
  };

  const handleColorChange = (color: string) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, color });
    }
  };

  const handlePwmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, isPwm: e.target.checked });
    }
  };

  const handleTextColorChange = (color: string) => {
    if (selectedPin) {
      onUpdatePin({ ...selectedPin, textColor: color });
    }
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

  const updateLegendItem = (index: number, changes: Partial<LegendItem>) => {
    onLegendItemsChange(legendItems.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  };

  return (
    <div className='w-80 bg-gray-50 border-l border-gray-300 flex flex-col p-4 shrink-0 h-full overflow-y-auto'>
      <h2 className='text-lg font-semibold mb-4 text-gray-700'>
        Project Settings
      </h2>
      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 mb-2'>
          Global Gap Size (px)
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
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-500">Distance between pins</span>
        </div>
      </div>

      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 mb-2'>
          Label Size
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLabelScaleChange(labelScale / 1.1)}
            className="w-8 h-7 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-bold"
            title="Smaller labels"
          >
            −
          </button>
          <span className="w-14 text-center text-sm text-gray-700 tabular-nums">{Math.round(labelScale * 100)}%</span>
          <button
            onClick={() => onLabelScaleChange(labelScale * 1.1)}
            className="w-8 h-7 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-bold"
            title="Larger labels"
          >
            +
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Labels zoom with the board. Resizing keeps their spacing proportional.</p>
      </div>

      <div className="mb-6">
        <label className='block text-sm font-medium text-gray-600 mb-2'>
          Anchor Size
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
          <span className="text-xs text-gray-500 w-8 text-right">{anchorSize}px</span>
        </div>
        {anchorSize === 0 && (
          <p className="text-[10px] text-gray-400 mt-1">Anchor is hidden. Straight line only.</p>
        )}
      </div>

      <button
        onClick={() => setIsTableSettingsExpanded(!isTableSettingsExpanded)}
        className='flex items-center justify-between w-full text-left text-lg font-semibold mb-4 text-gray-700 hover:text-gray-900'
      >
        <span>Table Settings</span>
        <span className="text-sm font-normal text-gray-400">
          {isTableSettingsExpanded ? '▲' : '▼'}
        </span>
      </button>

      {isTableSettingsExpanded && (
        <div className="mb-6 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isLegendVisible}
              onChange={(e) => onLegendVisibilityChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            Show Table on Canvas
          </label>

          {isLegendVisible && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase">Rows</div>
              {legendItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={item.color}
                    onChange={(e) => updateLegendItem(index, { color: e.target.value })}
                    className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateLegendItem(index, { text: e.target.value })}
                    className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      onLegendItemsChange(legendItems.filter((_, i) => i !== index));
                    }}
                    className="text-red-500 hover:text-red-700 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  onLegendItemsChange([...legendItems, { id: crypto.randomUUID(), text: 'NEW ROW', color: '#888888' }]);
                }}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 py-1 font-medium"
              >
                + Add Row
              </button>
            </div>
          )}
        </div>
      )}

      <hr className="my-4 border-gray-300" />

      {selectedImage && (
        <>
          <h2 className='text-lg font-semibold mb-4 text-gray-700'>
            Image Properties
          </h2>
          <div className='space-y-4 mb-4'>
            <div>
              <label className='block text-sm font-medium text-gray-600 mb-1'>
                Width (px)
              </label>
              <input
                type='number'
                className='w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500'
                value={Math.round(selectedImage.width)}
                onChange={(e) => {
                  const newW = Number(e.target.value);
                  if (newW > 0) {
                    const ratio = selectedImage.height / selectedImage.width;
                    onUpdateImage({
                      ...selectedImage,
                      width: newW,
                      height: newW * ratio
                    }, false);
                  }
                }}
                onFocus={() => onPushHistory()}
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-600 mb-1'>
                Height (px)
              </label>
              <input
                type='number'
                className='w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500'
                value={Math.round(selectedImage.height)}
                onChange={(e) => {
                  const newH = Number(e.target.value);
                  if (newH > 0) {
                    const ratio = selectedImage.width / selectedImage.height;
                    onUpdateImage({
                      ...selectedImage,
                      height: newH,
                      width: newH * ratio
                    }, false);
                  }
                }}
                onFocus={() => onPushHistory()}
              />
            </div>
            <p className="text-xs text-gray-400">
              Aspect ratio is maintained automatically.
            </p>
            <button
              onClick={onExportPinoutTemplate}
              className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
              title="Download the current pins and lines, relative to this image, as a ready-made pinout for the product library"
            >
              Export as library pinout
            </button>
          </div>
          <hr className="my-4 border-gray-300" />
        </>
      )}

      <h2 className='text-lg font-semibold mb-4 text-gray-700'>
        {selectedLine ? 'Line Properties' : 'Pin Properties'}
      </h2>

      {!selectedPin && !selectedLine ? (
        <div className='text-gray-400 text-sm'>
          Select a pin or line to edit properties.
        </div>
      ) : selectedLine ? (
        <div className='space-y-4'>
           <div>
            <label className='block text-sm font-medium text-gray-600 mb-2'>
              Line Color
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
                        ? '0 0 0 2px white, 0 0 0 4px gray'
                        : 'none',
                  }}
                  onClick={() => onUpdateLine({ ...selectedLine, color: c })}
                ></div>
              ))}
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              Thickness (px)
            </label>
            <input
              type='number'
              min='1'
              className='w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500'
              value={selectedLine.thickness}
              onChange={(e) => onUpdateLine({ ...selectedLine, thickness: Number(e.target.value) || 1 }, false)}
              onFocus={() => onPushHistory()}
            />
          </div>
        </div>
      ) : selectedPin ? (
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              Pin Name
            </label>
            <input
              ref={nameInputRef}
              type='text'
              className='w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500'
              value={selectedPin.text}
              onChange={handleNameChange}
              onFocus={() => onPushHistory()}
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-600 mb-2'>
              Label Color
            </label>
            <div className='grid grid-cols-4 gap-2'>
              {COLORS.map((c) => (
                <div
                  key={c}
                  className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110`}
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      selectedPin.color === c
                        ? '0 0 0 2px white, 0 0 0 4px gray'
                        : 'none',
                  }}
                  onClick={() => handleColorChange(c)}
                ></div>
              ))}
              <div
                className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 relative flex items-center justify-center overflow-hidden`}
                style={{
                  background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                  boxShadow: !COLORS.includes(selectedPin.color)
                    ? '0 0 0 2px white, 0 0 0 4px gray'
                    : 'none',
                }}
                title="Custom Color"
              >
                <input
                  type="color"
                  value={selectedPin.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-600 mb-2'>
              Text Color
            </label>
            <div className='flex items-center gap-2'>
              <div
                className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 relative flex items-center justify-center overflow-hidden border border-gray-300`}
                title="Custom Text Color"
              >
                <input
                  type="color"
                  value={selectedPin.textColor || (isLightColor(selectedPin.color) ? '#000000' : '#ffffff')}
                  onChange={(e) => handleTextColorChange(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                />
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: selectedPin.textColor || (isLightColor(selectedPin.color) ? '#000000' : '#ffffff') }}
                ></div>
              </div>
              <span className="text-xs text-gray-500">Pick a custom text color</span>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              checked={selectedPin.isPwm}
              onChange={handlePwmChange}
            />
            <label className='text-sm text-gray-600'>PWM Capable</label>
          </div>

          <hr className="my-4 border-gray-300" />

          <div>
            <label className='block text-sm font-medium text-gray-600 mb-2'>
              Position Adjustment (px)
            </label>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">Step:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={customStep}
                onChange={(e) => setCustomStep(Number(e.target.value) || 1)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div></div>
              <button
                onClick={() => handleMoveUp(customStep)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded text-xs font-bold"
                title={`Move Up ${customStep}px`}
              >
                ↑
              </button>
              <div></div>

              <button
                onClick={() => handleMoveLeft(customStep)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded text-xs font-bold"
                title={`Move Left ${customStep}px`}
              >
                ←
              </button>
              <div className="flex items-center justify-center text-xs text-gray-500 font-medium">
                {customStep}px
              </div>
              <button
                onClick={() => handleMoveRight(customStep)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded text-xs font-bold"
                title={`Move Right ${customStep}px`}
              >
                →
              </button>

              <div></div>
              <button
                onClick={() => handleMoveDown(customStep)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded text-xs font-bold"
                title={`Move Down ${customStep}px`}
              >
                ↓
              </button>
              <div></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Use these buttons to fine-tune the label's position relative to other pins.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
