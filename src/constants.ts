import type { LegendItem } from './types';

export const DEFAULT_LEGEND_ITEMS: readonly LegendItem[] = [
  { id: '1', text: 'POWER', color: '#dc2626' },
  { id: '2', text: 'GROUND', color: '#000000' },
  { id: '3', text: 'PHYSICAL PIN', color: '#0d9488' },
  { id: '4', text: 'CONTROL', color: '#ca8a04' },
  { id: '5', text: 'ANALOG', color: '#16a34a' },
  { id: '6', text: 'TIMER & CHANNEL', color: '#e11d48' },
  { id: '7', text: 'USART', color: '#1d4ed8' },
  { id: '8', text: 'SPI', color: '#9333ea' },
  { id: '9', text: 'I2C', color: '#0ea5e9' },
  { id: '10', text: 'CAN BUS', color: '#db2777' },
  { id: '11', text: 'USB', color: '#65a30d' },
  { id: '12', text: 'MISC', color: '#4b5563' },
  { id: '13', text: 'BOARD HARDWARE', color: '#ea580c' },
];

export const DEFAULT_GAP_SIZE = 12;
export const DEFAULT_ANCHOR_SIZE = 5;
