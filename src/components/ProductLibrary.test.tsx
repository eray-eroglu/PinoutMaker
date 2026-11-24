import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductLibrary } from './ProductLibrary';

const validPinout = {
  version: 1, imageWidth: 100, imageHeight: 50, labelScale: 1,
  pins: [{ id: 'a', x: 1, y: 2, targetX: 3, targetY: 4, text: 'PA0', color: '#000', isPwm: false }],
};

const rows = [
  { id: 1, name: 'Blue Pill', category: 'MCU', image_url: 'x.png', pinout: validPinout },
  { id: 2, name: 'Plain Board', category: 'MCU', image_url: 'y.png' }, // column missing / undefined
  { id: 3, name: 'Broken Pinout', category: 'MCU', image_url: 'z.png', pinout: { version: 99 } },
];

// The chain is awaited once, at abortSignal(); every earlier call returns the same builder.
vi.mock('../supabaseClient', () => {
  const builder = {
    select: () => builder,
    order: () => builder,
    retry: () => builder,
    abortSignal: () => Promise.resolve({ data: rows, error: null }),
  };
  return { supabase: { from: () => builder } };
});

describe('ProductLibrary pinout offers', () => {
  const setup = async () => {
    const onImportProduct = vi.fn();
    render(<ProductLibrary isOpen onClose={() => {}} onImportProduct={onImportProduct} />);
    await screen.findByText('Blue Pill');
    return onImportProduct;
  };

  it('shows the badge and two choices only for products with a valid pinout', async () => {
    await setup();
    expect(screen.getAllByText('Pinout')).toHaveLength(1);
    expect(screen.getAllByText('Image + pinout')).toHaveLength(1);
    expect(screen.getAllByText('Image only')).toHaveLength(1);
    // The plain and the broken product keep the single button
    expect(screen.getAllByText('Add to Canvas')).toHaveLength(2);
  });

  it('passes withPinout=true for "Image + pinout" and false for "Image only"', async () => {
    const onImportProduct = await setup();
    fireEvent.click(screen.getByText('Image + pinout'));
    await waitFor(() => expect(onImportProduct).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }), true));
    fireEvent.click(screen.getByText('Image only'));
    expect(onImportProduct).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }), false);
  });

  it('imports image only for products without a usable pinout', async () => {
    const onImportProduct = await setup();
    fireEvent.click(screen.getAllByText('Add to Canvas')[0]);
    expect(onImportProduct).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }), false);
  });
});
