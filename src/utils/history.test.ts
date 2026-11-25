import { describe, it, expect } from 'vitest';
import { createEditSession, deepEqual } from './history';

describe('createEditSession', () => {
  it('records history only on the first change of a session', () => {
    const s = createEditSession();
    s.start();
    expect([s.next(), s.next(), s.next()]).toEqual([true, false, false]);
  });

  it('records nothing for a session without changes (focus, then blur)', () => {
    const s = createEditSession();
    s.start();
    s.end();
    // The next session starts fresh
    s.start();
    expect(s.next()).toBe(true);
  });

  it('a new session (e.g. reopening the picker) records again', () => {
    const s = createEditSession();
    s.start();
    s.next();
    s.start();
    expect(s.next()).toBe(true);
  });

  it('continues an undo step the caller already recorded', () => {
    const s = createEditSession();
    s.start(true);
    expect(s.next()).toBe(false);
  });
});

describe('deepEqual', () => {
  it('compares nested plain data', () => {
    const pin = { id: 'a', x: 1, functions: [{ id: 'f', text: 'ADC0' }] };
    expect(deepEqual(pin, { ...pin, functions: [{ id: 'f', text: 'ADC0' }] })).toBe(true);
    expect(deepEqual(pin, { ...pin, functions: [{ id: 'f', text: 'ADC1' }] })).toBe(false);
    expect(deepEqual(pin, { ...pin, x: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual({ a: [] }, { a: {} })).toBe(false);
  });

  it('treats a key set to undefined like a missing one', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});

describe('deepEqual on legend rows (no-op legend edits record no undo step)', () => {
  it('treats copied rows as equal and a changed text or colour as different', () => {
    const rows = [{ id: 'a', text: 'GPIO', color: '#16a34a' }];
    expect(deepEqual(rows.map(r => ({ ...r })), rows)).toBe(true);
    expect(deepEqual([{ ...rows[0], text: 'IO' }], rows)).toBe(false);
    expect(deepEqual([{ ...rows[0], color: '#000000' }], rows)).toBe(false);
    expect(deepEqual([...rows, { id: 'b', text: 'X', color: '#888888' }], rows)).toBe(false);
  });
});
