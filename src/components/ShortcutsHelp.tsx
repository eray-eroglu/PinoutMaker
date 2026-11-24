const SHORTCUTS: Array<[string, string]> = [
  ['Arrow keys', 'Nudge selection 1 px (Shift: 10 px)'],
  ['Alt + Arrow keys', 'Move whole pin (label and anchor)'],
  ['Shift / Ctrl + click', 'Add / remove a pin from the selection'],
  ['Shift + drag', 'Select pins in an area (on empty canvas or the board)'],
  ['Ctrl + A', 'Select all pins'],
  ['Alt + drag label', 'Move whole pins (labels and anchors)'],
  ['Ctrl + D', 'Duplicate selected pins or line'],
  ['Ctrl + C / Ctrl + V', 'Copy / paste selected pins or line'],
  ['Del / Backspace', 'Delete selection'],
  ['Ctrl + Z / Ctrl + Y', 'Undo / redo'],
  ['Ctrl + S', 'Save'],
  ['Shift + 1', 'Fit to screen'],
  ['Ctrl + 0', 'Reset zoom to 100%'],
  ['Ctrl + = / Ctrl + -', 'Zoom in / out'],
  ['Esc', 'Clear selection, cancel drawing'],
  ['?', 'Show / hide this help'],
];

export const ShortcutsHelp = ({ onClose }: { onClose: () => void }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30' onClick={onClose}>
    <div
      role='dialog'
      aria-label='Keyboard shortcuts'
      className='bg-white rounded-lg shadow-xl p-4 w-96 max-w-[90vw]'
      onClick={e => e.stopPropagation()}
    >
      <h2 className='text-sm font-semibold text-gray-800 mb-2'>Keyboard shortcuts</h2>
      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs'>
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className='contents'>
            <dt className='font-mono text-gray-800 whitespace-nowrap'>{keys}</dt>
            <dd className='text-gray-600'>{action}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);
