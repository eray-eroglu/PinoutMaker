import { useState, useRef, useEffect } from 'react';
import type { PinData } from '../types';

interface SidebarProps {
  selectedPin: PinData | null;
  onUpdatePin: (pin: PinData, saveHistory?: boolean) => void;
  onPushHistory: () => void;
  scale: number;
  gapSize: number;
  onGapSizeChange: (size: number) => void;
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

export const Sidebar = ({ selectedPin, onUpdatePin, onPushHistory, scale, gapSize, onGapSizeChange }: SidebarProps) => {
  const [customStep, setCustomStep] = useState<number>(5);
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

  if (!selectedPin) {
    return (
      <div className='w-80 bg-gray-50 border-l border-gray-300 flex flex-col p-4 shrink-0 h-full'>
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
            <span className="text-xs text-gray-500">Distance between snapped pins</span>
          </div>
        </div>

        <h2 className='text-lg font-semibold mt-6 mb-4 text-gray-700'>
          Pin Properties
        </h2>
        <div className='text-gray-400 text-sm'>
          Select a pin to edit properties.
        </div>
      </div>
    );
  }

  return (
    <div className='w-80 bg-gray-50 border-l border-gray-300 flex flex-col p-4 shrink-0 h-full'>
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

      <hr className="my-4 border-gray-300" />

      <h2 className='text-lg font-semibold mb-4 text-gray-700'>
        Pin Properties
      </h2>

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
    </div>
  );
};
