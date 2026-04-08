import { useState, useRef, useEffect } from 'react';
import type { PinData, LegendItem } from '../types';
import type { LoadedImage } from '../App';
import { isLightColor } from '../utils/colorUtils';

interface SidebarProps {
  selectedPin: PinData | null;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  selectedImage: LoadedImage | null;
  onUpdateImage: (img: LoadedImage, saveHistory?: boolean) => void;
  onPushHistory: () => void;
  scale: number;
  gapSize: number;
  onGapSizeChange: (size: number) => void;
  legendItems: LegendItem[];
  onLegendItemsChange: (items: LegendItem[]) => void;
  isLegendVisible: boolean;
  onLegendVisibilityChange: (visible: boolean) => void;
  anchorSize: number;
  onAnchorSizeChange: (size: number) => void;
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

const getSmartColor = (text: string): string | null => {
  const upperText = text.toUpperCase().trim();

  if (upperText === 'GND') return '#000000'; // GROUND
  if (['VCC', '5V', '3V3', 'VIN', 'VDD', 'VSS'].includes(upperText)) return '#dc2626'; // POWER
  if (['GPIO', 'PB', 'PA', 'PC'].includes(upperText) || (upperText.startsWith('P') && upperText.length <= 4 && !isNaN(Number(upperText.slice(2))))) return '#0d9488'; // PHYSICAL PIN
  if (['SDA', 'SCL', 'I2C'].includes(upperText)) return '#0ea5e9'; // I2C
  if (upperText.startsWith('ADC') || upperText.startsWith('AIN') || upperText.startsWith('DAC')) return '#16a34a'; // ANALOG
  if (['RX', 'TX', 'CTS', 'RTS'].includes(upperText) || upperText.startsWith('UART') || upperText.startsWith('USART')) return '#1d4ed8'; // USART
  if (['CS', 'SCK', 'MOSI', 'MISO', 'NSS', 'CLK'].includes(upperText) || upperText.startsWith('SPI')) return '#9333ea'; // SPI
  if (upperText.startsWith('CAN')) return '#db2777'; // CAN BUS
  if (upperText.startsWith('TIM') || upperText.startsWith('CH')) return '#e11d48'; // TIMER & CHANNEL
  if (upperText.startsWith('USB') || ['D+', 'D-'].includes(upperText)) return '#65a30d'; // USB
  if (['EN', 'BOOT', 'RST', 'RESET'].includes(upperText)) return '#ca8a04'; // CONTROL

  return null;
};

export const Sidebar = ({
  selectedPin, onUpdatePin, selectedImage, onUpdateImage, onPushHistory, scale, gapSize, onGapSizeChange,
  legendItems, onLegendItemsChange, isLegendVisible, onLegendVisibilityChange, anchorSize, onAnchorSizeChange
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
      const smartColor = getSmartColor(newText);

      onUpdatePin({
        ...selectedPin,
        text: newText,
        color: smartColor || selectedPin.color
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

  // --- Mesafe Ayarlama Mantığı ---
  // Kullanıcıdan px cinsinden değer alıp, bunu pinin x/y koordinatlarına yansıtacağız.
  // "Solundaki/Sağındaki" derken, en yakın pini veya hedef noktayı (anchor) baz alabiliriz.
  // Şimdilik en basit haliyle: Seçili pinin X koordinatını manuel olarak px cinsinden kaydırma.

  const handleMoveLeft = (px: number) => {
    if (selectedPin) {
      // Sola kaydırmak için X değerini azaltıyoruz.
      // labelDx/labelDy kullanıyorsak onları da güncellemeliyiz.
      const newX = selectedPin.x - px;
      const newDx = (newX - selectedPin.targetX) * scale;
      onUpdatePin({ ...selectedPin, x: newX, labelDx: newDx });
    }
  };

  const handleMoveRight = (px: number) => {
    if (selectedPin) {
      const newX = selectedPin.x + px;
      const newDx = (newX - selectedPin.targetX) * scale;
      onUpdatePin({ ...selectedPin, x: newX, labelDx: newDx });
    }
  };

  const handleMoveUp = (px: number) => {
    if (selectedPin) {
      const newY = selectedPin.y - px;
      const newDy = (newY - selectedPin.targetY) * scale;
      onUpdatePin({ ...selectedPin, y: newY, labelDy: newDy });
    }
  };

  const handleMoveDown = (px: number) => {
    if (selectedPin) {
      const newY = selectedPin.y + px;
      const newDy = (newY - selectedPin.targetY) * scale;
      onUpdatePin({ ...selectedPin, y: newY, labelDy: newDy });
    }
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
            onChange={(e) => onGapSizeChange(Number(e.target.value) || 12)}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-500">Distance between pins</span>
        </div>
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
                    onChange={(e) => {
                      const newItems = [...legendItems];
                      newItems[index].color = e.target.value;
                      onLegendItemsChange(newItems);
                    }}
                    className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...legendItems];
                      newItems[index].text = e.target.value;
                      onLegendItemsChange(newItems);
                    }}
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
                onBlur={() => onPushHistory()}
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
                onBlur={() => onPushHistory()}
              />
            </div>
            <p className="text-xs text-gray-400">
              Aspect ratio is maintained automatically.
            </p>
          </div>
          <hr className="my-4 border-gray-300" />
        </>
      )}

      <h2 className='text-lg font-semibold mb-4 text-gray-700'>
        Pin Properties
      </h2>

      {!selectedPin ? (
        <div className='text-gray-400 text-sm'>
          Select a pin to edit properties.
        </div>
      ) : (
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
      )}
    </div>
  );
};
