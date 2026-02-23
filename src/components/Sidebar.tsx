import { useState } from 'react';
import type { PinData } from '../types';

interface SidebarProps {
  selectedPin: PinData | null;
  onUpdatePin: (pin: PinData) => void;
  pins: PinData[];
  scale: number;
}

const COLORS = [
  '#f50c0c', // red-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#eab308', // yellow-500
  '#000000', // black
  '#6b7280', // gray-500 (default/neutral)
  '#034d13', // cyan-400 (extra option)
  '#ed403a', // red-500 (extra option)
  '#335cb4', // blue-600 (extra option)
];

const getSmartColor = (text: string): string | null => {
  const upperText = text.toUpperCase().trim();
  
  if (upperText === 'GND') return '#000000'; // Black
  if (['VCC', '5V', '3V3'].includes(upperText)) return '#f50c0c'; // Red
  if (['GPIO', 'PB', 'PA', 'PC'].includes(upperText)) return '#a855f7'; // Purple
  if (['SDA', 'SCL'].includes(upperText)) return '#22c55e'; // Green
  if (['ADC'].includes(upperText)) return '#f97316'; // Orange
  if (['RX', 'TX', 'CTS', 'RTS'].includes(upperText)) return '#3b82f6'; // Blue
  if (['CS', 'SCK', 'MOSI', 'MISO', 'NSS', 'CLK'].includes(upperText)) return '#ec4899'; // Pink
  
  return null;
};

export const Sidebar = ({ selectedPin, onUpdatePin, pins, scale }: SidebarProps) => {
  const [customStep, setCustomStep] = useState<number>(5);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPin) {
      const newText = e.target.value;
      const smartColor = getSmartColor(newText);
      
      onUpdatePin({ 
        ...selectedPin, 
        text: newText,
        color: smartColor || selectedPin.color 
      });
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
        Pin Properties
      </h2>

      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-600 mb-1'>
            Pin Name
          </label>
          <input
            type='text'
            className='w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500'
            value={selectedPin.text}
            onChange={handleNameChange}
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
