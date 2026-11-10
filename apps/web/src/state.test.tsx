import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createSpec, readiness } from '../../../packages/shared/src/domain';
import type { Spec } from '../../../packages/shared/src/schema';

/** The project hook: loading, serialised autosaves, conflicts, and the small persistence hooks. */
// Node 26 exposes its own (empty) localStorage global that hides jsdom's; use an in-memory Storage.
const memory = new Map<string, string>();
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
const api = vi.fn();
vi.mock('./api', async (original) => ({ ...(await original<typeof import('./api')>()), api: (...args: unknown[]) => api(...args) }));
const { useProject, useDebouncedSave, useLocalStorage } = await import('./state');
const { ApiError } = await import('./api');

afterEach(() => {
  api.mockReset();
  vi.useRealTimers();
  localStorage.clear();
});

const spec = (revision: number): Spec => ({ ...createSpec('00000000-0000-4000-8000-00000000000a', 'Hook test'), revision });
const response = (s: Spec) => ({ spec: s, role: 'Editor', readiness: readiness(s), pendingProposals: 2 });
const answer = (value: string) => ({ sections: [{ id: 'discovery', answers: { 'discovery.1': { value, state: 'answered' as const, reason: '' } } }] });

describe('useProject', () => {
  it('loads the project and exposes role, readiness and pending proposals', async () => {
    api.mockResolvedValue(response(spec(3)));
    const { result } = renderHook(() => useProject('p1', () => {}));
    await waitFor(() => expect(result.current.spec?.revision).toBe(3));
    expect(result.current.role).toBe('Editor');
    expect(result.current.pendingProposals).toBe(2);
    expect(result.current.readiness?.total).toBeGreaterThan(0);
    expect(api).toHaveBeenCalledWith('/projects/p1');
  });

  it('serialises saves so each uses the revision returned by the previous one', async () => {
    api.mockResolvedValueOnce(response(spec(1)));
    const sent: number[] = [];
    api.mockImplementation(async (_path: string, _method: string, body: { expectedRevision: number }) => {
      sent.push(body.expectedRevision);
      await new Promise((r) => setTimeout(r, 5));
      return spec(body.expectedRevision + 1);
    });
    const { result } = renderHook(() => useProject('p1', () => {}));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    await act(async () => {
      await Promise.all([result.current.save(answer('a')), result.current.save(answer('b')), result.current.save(answer('c'))]);
    });
    expect(sent).toEqual([1, 2, 3]);
    expect(result.current.spec?.revision).toBe(4);
    expect(result.current.status).toBe('saved');
  });

  it('skips a builder that returns no patch, and reports ordinary errors', async () => {
    api.mockResolvedValueOnce(response(spec(1)));
    const onError = vi.fn();
    const { result } = renderHook(() => useProject('p1', onError));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    await act(async () => {
      expect(await result.current.save(() => null)).toMatchObject({ revision: 1 });
    });
    expect(api).toHaveBeenCalledTimes(1);
    api.mockRejectedValueOnce(new Error('Server unavailable'));
    await act(async () => {
      expect(await result.current.save(answer('x'))).toBeNull();
    });
    expect(result.current.status).toBe('error');
    expect(onError).toHaveBeenCalledWith('Server unavailable');
  });

  it('opens the conflict view on a stale write, then discards or re-applies', async () => {
    api.mockResolvedValueOnce(response(spec(1)));
    const { result } = renderHook(() => useProject('p1', () => {}));
    await waitFor(() => expect(result.current.spec).not.toBeNull());
    const info = { baseRevision: 1, currentRevision: 2, overlapping: true, conflicts: [] };
    api.mockRejectedValueOnce(new ApiError('Changed', 409, { conflict: info }));
    await act(async () => {
      await result.current.save(answer('mine'), 'Problem to solve');
    });
    expect(result.current.status).toBe('conflict');
    expect(result.current.conflict).toMatchObject({ info, label: 'Problem to solve' });

    api.mockResolvedValueOnce(response(spec(2)));
    const epoch = result.current.epoch;
    await act(async () => {
      await result.current.resolveConflict('discard');
    });
    expect(result.current.conflict).toBeNull();
    expect(result.current.spec?.revision).toBe(2);
    expect(result.current.epoch).toBe(epoch + 1);
    expect(result.current.status).toBe('idle');

    api.mockRejectedValueOnce(new ApiError('Changed', 409, { conflict: { ...info, baseRevision: 2, currentRevision: 3 } }));
    await act(async () => {
      await result.current.save(answer('mine again'));
    });
    api.mockResolvedValueOnce(response(spec(3))).mockResolvedValueOnce(spec(4));
    await act(async () => {
      await result.current.resolveConflict('reapply');
    });
    expect(api).toHaveBeenLastCalledWith('/projects/00000000-0000-4000-8000-00000000000a', 'PATCH', { expectedRevision: 3, patch: answer('mine again') });
    expect(result.current.spec?.revision).toBe(4);
  });

  it('picks up teammates’ newer revisions every 15 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.mockResolvedValueOnce(response(spec(1)));
    const { result } = renderHook(() => useProject('p1', () => {}));
    await waitFor(() => expect(result.current.spec?.revision).toBe(1));
    api.mockResolvedValueOnce({ ...response(spec(5)), pendingProposals: 7 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.spec?.revision).toBe(5);
    api.mockResolvedValueOnce({ ...response(spec(5)), pendingProposals: 9 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.pendingProposals).toBe(9);
  });

  it('reports a failed load and does nothing without a project', async () => {
    api.mockRejectedValueOnce(new Error('Project not found'));
    const onError = vi.fn();
    renderHook(() => useProject('missing', onError));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Project not found'));
    api.mockReset();
    const { result } = renderHook(() => useProject(undefined, () => {}));
    expect(result.current.spec).toBeNull();
    expect(result.current.role).toBe('Viewer');
    await act(async () => {
      expect(await result.current.save(answer('x'))).toBeNull();
    });
    expect(api).not.toHaveBeenCalled();
  });
});

describe('useDebouncedSave and useLocalStorage', () => {
  it('saves after the delay, flushes on demand and on unmount', async () => {
    vi.useFakeTimers();
    const persist = vi.fn();
    const { rerender, result, unmount } = renderHook(({ value, dirty }) => useDebouncedSave(value, dirty, persist, 100), { initialProps: { value: 'a', dirty: true } });
    rerender({ value: 'ab', dirty: true });
    vi.advanceTimersByTime(99);
    expect(persist).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(persist).toHaveBeenCalledWith('ab');
    rerender({ value: 'abc', dirty: true });
    result.current();
    expect(persist).toHaveBeenLastCalledWith('abc');
    unmount();
    expect(persist).toHaveBeenCalledTimes(3);
  });

  it('does not save clean values', () => {
    const persist = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedSave('x', false, persist, 10));
    result.current();
    unmount();
    expect(persist).not.toHaveBeenCalled();
  });

  it('keeps values in localStorage and survives unreadable storage', () => {
    const { result } = renderHook(() => useLocalStorage('k', 1));
    act(() => result.current[1](5));
    expect(localStorage.getItem('k')).toBe('5');
    expect(renderHook(() => useLocalStorage('k', 1)).result.current[0]).toBe(5);
    localStorage.setItem('broken', '{not json');
    expect(renderHook(() => useLocalStorage('broken', 'fallback')).result.current[0]).toBe('fallback');
  });
});
