import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Splitter } from './Splitter';
import { rubberband } from '../motion';

/** The panel divider: pointer and keyboard, and a soft edge past its limits. */
const setup = (value = 400) => {
  const onChange = vi.fn();
  render(<Splitter value={value} min={300} max={500} onChange={onChange} label="Resize panels" />);
  return { onChange, handle: screen.getByRole('separator', { name: 'Resize panels' }) };
};
const offset = (el: HTMLElement) =>
  Number(/translateX\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1] ?? 0);

describe('Splitter', () => {
  it('follows the pointer within its limits', () => {
    const { onChange, handle } = setup();
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(450);
    expect(offset(handle)).toBe(0);
  });

  it('gives with growing resistance past a limit, keeps the value at the limit, and settles on release', async () => {
    const { onChange, handle } = setup(480);
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 220, pointerId: 1 });
    // 480 + 120 wants 600: the value stops at 500, and the handle gives the rubber-band share of the 100 px over.
    expect(onChange).toHaveBeenLastCalledWith(500);
    // Motion writes the style on the next frame.
    await vi.waitFor(() => expect(offset(handle)).toBeCloseTo(rubberband(100, 120), 1));
    expect(offset(handle)).toBeLessThan(100);
    fireEvent.pointerUp(handle, { clientX: 220, pointerId: 1 });
    await vi.waitFor(() => expect(Math.abs(offset(handle))).toBeLessThan(0.5), { timeout: 3000 });
  });

  it('keeps the keyboard: arrows, Shift for larger steps, Home and End', () => {
    const { onChange, handle } = setup();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(416);
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(336);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(500);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(300);
  });
});
