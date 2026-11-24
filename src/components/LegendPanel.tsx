import { useMemo } from 'react';
import type { LegendItem, LegendMode, PinData } from '../types';
import { getLegendRows } from '../utils/legend';

interface LegendPanelProps {
  legendItems: LegendItem[];
  pins: PinData[];
  mode: LegendMode;
  showCounts: boolean;
}

/** The "TABLE" overlay on the canvas. Rows come from getLegendRows, the same function the PDF uses. */
export const LegendPanel = ({ legendItems, pins, mode, showCounts }: LegendPanelProps) => {
  const rows = useMemo(() => getLegendRows(legendItems, pins, mode), [legendItems, pins, mode]);

  return (
    <div className="absolute top-4 left-4 bg-[#e6e6e6] border border-gray-300 rounded shadow-md p-2 w-48 pointer-events-none opacity-90">
      <h3 className="text-xs font-normal text-gray-600 mb-2 uppercase tracking-wider">TABLE</h3>
      <div className="flex flex-col gap-[2px]">
        {rows.map(({ item, used, count }) => (
          <div
            key={item.id}
            className="relative flex items-center justify-center text-white text-[10px] font-normal py-1 border border-black/50"
            style={{ backgroundColor: item.color, opacity: mode === 'dimUnused' && !used ? 0.35 : 1 }}
          >
            {item.text}
            {showCounts && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] opacity-90">{count}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-300 flex flex-col gap-1 text-[10px] text-gray-600">
        <div className="flex items-center gap-2">
          <svg width="20" height="10" className="overflow-visible">
            <path d="M 0 5 L 20 5" stroke="black" strokeWidth="1" />
          </svg>
          <span>Standard Pin</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="20" height="10" className="overflow-visible">
            <path d="M 0 5 Q 5 0, 10 5 T 20 5" stroke="black" strokeWidth="1" fill="none" />
          </svg>
          <span>PWM Pin</span>
        </div>
      </div>
    </div>
  );
};
