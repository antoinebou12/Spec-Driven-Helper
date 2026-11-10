import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { applyTheme, useAppearance } from './appearance';

/** Light or dark follows the system, live, until the person picks one (HIG: Dark Mode). */
let dark = false;
let listeners: ((e: { matches: boolean }) => void)[] = [];
// Node exposes its own (empty) localStorage global that hides jsdom's; use an in-memory Storage, as state.test.tsx does.
const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() {
      return memory.size;
    },
  } satisfies Storage);
  dark = false;
  listeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return dark;
    },
    addEventListener: (_: string, f: (e: { matches: boolean }) => void) => listeners.push(f),
    removeEventListener: (_: string, f: (e: { matches: boolean }) => void) =>
      (listeners = listeners.filter((l) => l !== f)),
  }));
});
afterEach(() => vi.unstubAllGlobals());
const systemTurns = (next: boolean) =>
  act(() => {
    dark = next;
    for (const f of listeners) f({ matches: next });
  });

it('starts from the system appearance and follows it when it changes', () => {
  const { result } = renderHook(() => useAppearance());
  expect(result.current).toMatchObject({ choice: 'system', theme: 'light' });
  systemTurns(true);
  expect(result.current.theme).toBe('dark');
  systemTurns(false);
  expect(result.current.theme).toBe('light');
});

it('keeps a chosen appearance whatever the system does, and remembers it', () => {
  const { result, unmount } = renderHook(() => useAppearance());
  act(() => result.current.setChoice('dark'));
  systemTurns(false);
  expect(result.current.theme).toBe('dark');
  unmount();
  expect(renderHook(() => useAppearance()).result.current).toMatchObject({
    choice: 'dark',
    theme: 'dark',
  });
});

it('eases a change of theme for a moment, but not the first paint', () => {
  vi.useFakeTimers();
  try {
    const root = document.createElement('div');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    expect(root.classList.contains('theme-fade')).toBe(false);
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    expect(root.classList.contains('theme-fade')).toBe(true);
    vi.advanceTimersByTime(300);
    expect(root.classList.contains('theme-fade')).toBe(false);
    applyTheme('dark', root);
    expect(root.classList.contains('theme-fade')).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it('ignores the old key, which held the first visit’s system appearance rather than a choice', () => {
  localStorage.setItem('sdd-theme', JSON.stringify('dark'));
  expect(renderHook(() => useAppearance()).result.current).toMatchObject({
    choice: 'system',
    theme: 'light',
  });
});
