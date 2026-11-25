import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StableLabel } from './StableLabel';

describe('StableLabel', () => {
  it('shows only the current text but lays out every variant in the same cell', () => {
    const { container } = render(
      <button type='button'>
        <StableLabel text='Add Pin' variants={['Add Pin', 'Pin ekle', 'Pin ekle']} />
      </button>,
    );
    // The accessible name is the visible text only
    expect(screen.getByRole('button', { name: 'Add Pin' })).toBeInTheDocument();
    const hidden = container.querySelectorAll('[aria-hidden]');
    // Neither the current text nor duplicates are laid out twice
    expect([...hidden].map(el => el.textContent)).toEqual(['Pin ekle']);
    hidden.forEach(el => expect(el).toHaveClass('invisible', 'col-start-1', 'row-start-1'));
  });
});
