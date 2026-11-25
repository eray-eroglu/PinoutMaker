/**
 * A button label that keeps one width in every language: each variant (the label's English and
 * Turkish text) is laid out in the same grid cell and only `text` is visible, so the cell is as
 * wide as the widest variant. Switching the language therefore never resizes the button or shifts
 * the ones next to it. Keep the variants to one label's translations: reserving room for other
 * texts (such as a state's instructions) makes the button needlessly wide.
 */
export const StableLabel = ({ text, variants }: { text: string; variants: readonly string[] }) => {
  const hidden = [...new Set(variants)].filter(v => v !== text);
  return (
    <span className='inline-grid'>
      <span className='col-start-1 row-start-1 whitespace-nowrap text-center'>{text}</span>
      {hidden.map(v => (
        <span key={v} aria-hidden className='invisible col-start-1 row-start-1 whitespace-nowrap'>
          {v}
        </span>
      ))}
    </span>
  );
};
