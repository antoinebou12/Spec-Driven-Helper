import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from './hooks';
import { api, ApiError, type ConflictInfo } from './api';
import { readiness } from '../../../packages/shared/src/domain';
import type { Role, Spec, SpecPatch } from '../../../packages/shared/src/schema';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type PendingConflict = { info: ConflictInfo; patch: SpecPatch; label: string };
type ProjectResponse = {
  spec: Spec;
  role: Role;
  readiness: ReturnType<typeof readiness>;
  pendingProposals: number;
};
export type PatchBuilder = SpecPatch | ((spec: Spec) => SpecPatch | null);

/**
 * Loads a project and serializes its writes. Each save is built from the latest known revision
 * at send time, so one person's rapid autosaves never conflict with each other; a 409 from
 * someone else's edit opens the conflict view instead of overwriting.
 */
export function useProject(projectId: string | undefined, onError: (message: string) => void) {
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [conflict, setConflict] = useState<PendingConflict | null>(null);
  /** Increments when the author discards unsaved work, so open editors drop their drafts. */
  const [epoch, setEpoch] = useState(0);
  const spec = useRef<Spec | null>(null);
  const openConflicts = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);

  const accept = useCallback((next: Spec) => {
    spec.current = next;
    setData((d) =>
      d ? { ...d, spec: next, readiness: readiness(next, { openConflicts: openConflicts.current }) } : d,
    );
  }, []);
  const load = useCallback(async () => {
    if (!projectId) return;
    const result = await api<ProjectResponse>(`/projects/${projectId}`);
    openConflicts.current = result.readiness.issues.find((i) => i.code === 'open-conflict')?.count ?? 0;
    spec.current = result.spec;
    setData(result);
    return result;
  }, [projectId]);

  const errorHandler = useLatest(onError);
  useEffect(() => {
    setData(null);
    spec.current = null;
    setConflict(null);
    setStatus('idle');
    load().catch((e) => errorHandler.current(e.message));
  }, [load, errorHandler]);

  // Pick up teammates' changes while nothing of ours is in flight.
  useEffect(() => {
    if (!projectId) return;
    const timer = setInterval(async () => {
      if (document.hidden || inFlight.current || conflict) return;
      try {
        const latest = await api<ProjectResponse>(`/projects/${projectId}`);
        if (!inFlight.current && latest.spec.revision > (spec.current?.revision ?? -1)) {
          openConflicts.current = latest.readiness.issues.find((i) => i.code === 'open-conflict')?.count ?? 0;
          spec.current = latest.spec;
          setData(latest);
        } else setData((d) => (d ? { ...d, pendingProposals: latest.pendingProposals } : d));
      } catch {
        // Transient; the next tick retries.
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [projectId, conflict]);

  const save = useCallback(
    (build: PatchBuilder, label = '') => {
      const run = async (): Promise<Spec | null> => {
        const current = spec.current;
        if (!current) return null;
        const patch = typeof build === 'function' ? build(current) : build;
        if (!patch) return current;
        inFlight.current++;
        setStatus('saving');
        try {
          const next = await api<Spec>(`/projects/${current.id}`, 'PATCH', { expectedRevision: current.revision, patch });
          accept(next);
          setStatus('saved');
          return next;
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && e.conflict) {
            setConflict({ info: e.conflict, patch, label });
            setStatus('conflict');
          } else {
            setStatus('error');
            onError((e as Error).message);
          }
          return null;
        } finally {
          inFlight.current--;
        }
      };
      const next = queue.current.then(run, run);
      queue.current = next;
      return next;
    },
    [accept, onError],
  );

  /** Resolves a stale write: reload the latest revision, then optionally re-apply ours on top. */
  const resolveConflict = useCallback(
    async (choice: 'discard' | 'reapply') => {
      const pending = conflict;
      setConflict(null);
      await load();
      if (choice === 'discard') setEpoch((e) => e + 1);
      setStatus('idle');
      if (choice === 'reapply' && pending) await save(pending.patch, pending.label);
    },
    [conflict, load, save],
  );

  return {
    spec: data?.spec ?? null,
    role: data?.role ?? ('Viewer' as Role),
    readiness: data?.readiness ?? null,
    pendingProposals: data?.pendingProposals ?? 0,
    status,
    conflict,
    epoch,
    save,
    accept,
    reload: load,
    resolveConflict,
  };
}
export type ProjectState = ReturnType<typeof useProject>;

/** Debounced value persistence with a flush for blur and keyboard save. */
export function useDebouncedSave<T>(value: T, dirty: boolean, persist: (v: T) => void, delay = 1200) {
  const latest = useRef({ value, dirty, persist });
  latest.current = { value, dirty, persist };
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => latest.current.persist(latest.current.value), delay);
    return () => clearTimeout(timer);
  }, [value, dirty, delay]);
  const flush = useCallback(() => {
    if (latest.current.dirty) latest.current.persist(latest.current.value);
  }, []);
  // Persist on unmount (switching question or section) so nothing typed is lost.
  useEffect(() => () => flush(), [flush]);
  return flush;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable (private mode); the value still works for this session.
    }
  }, [key, value]);
  return [value, setValue] as const;
}
