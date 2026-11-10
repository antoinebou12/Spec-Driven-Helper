import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, ApiError } from '../api';
import { describePath, displayValue } from '../paths';
import { ConflictDialog } from './ConflictDialog';
import GeneratedUIForm from './GeneratedUI';
import { LanguageProvider } from '../i18n';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.restoreAllMocks());

describe('API client', () => {
  it('sends JSON with credentials and returns the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }));
    expect(await api('/projects', 'POST', { name: 'A' })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/projects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"A"}',
    });
  });
  it('raises ApiError with the server message and conflict details', async () => {
    const conflict = { baseRevision: 1, currentRevision: 2, overlapping: true, conflicts: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'Stale write', conflict }, 409));
    const error = await api('/projects/x', 'PATCH', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Stale write');
    expect(error.status).toBe(409);
    expect(error.conflict).toEqual(conflict);
  });
  it('describes a failure without a JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('down', { status: 502 }));
    await expect(api('/health')).rejects.toThrow('Request failed (502)');
  });
});

describe('change paths', () => {
  it('names sections, answers, items, links and top-level fields', () => {
    expect(describePath('sections.scope.markdown', 'en')).toMatch(/^Scope.* › Document$/);
    expect(describePath('sections.scope.answers.scope.1', 'fr')).toMatch(/^Périmètre et exigences › .+/);
    expect(describePath('items.REQ-001', 'en')).toBe('Item REQ-001');
    expect(describePath('links.l1', 'fr')).toBe('Lien l1');
    expect(describePath('localOnly', 'en')).toBe('Local-only AI');
    expect(describePath('unknownField', 'en')).toBe('unknownField');
  });
  it('formats values for side-by-side comparison', () => {
    expect(displayValue('name', undefined, 'en')).toBe('');
    expect(displayValue('sections.scope.references', [{ title: 'RFC', url: 'https://x.y' }], 'en')).toBe('- RFC <https://x.y>');
    expect(
      displayValue('items.REQ-1', { id: 'REQ-1', type: 'requirement', status: 'draft', priority: 'must', title: 'Title', body: 'Body', acceptance: 'Fast' }, 'en'),
    ).toBe('REQ-1 (requirement, draft, must)\n\nTitle\n\nBody\n\nAcceptance: Fast');
    expect(displayValue('links.l1', { from: 'TEST-1', kind: 'tests', to: 'REQ-1' }, 'en')).toContain('tests');
    expect(displayValue('stack', [1, 2], 'en')).toBe('[\n  1,\n  2\n]');
  });
});

describe('conflict dialog', () => {
  const pending = (overlapping: boolean) => ({
    label: 'Edit',
    patch: {},
    info: {
      baseRevision: 3,
      currentRevision: 5,
      overlapping,
      conflicts: overlapping ? [{ path: 'description', current: 'Theirs', yours: 'Mine' }] : [],
    },
  });
  it('renders nothing without a conflict', () => {
    const { container } = render(<ConflictDialog conflict={null} onResolve={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('compares overlapping edits and asks before replacing', async () => {
    const onResolve = vi.fn();
    render(<ConflictDialog conflict={pending(true) as any} onResolve={onResolve} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('revision 3; revision 5 is now current');
    expect(screen.getByText('Theirs')).toBeInTheDocument();
    expect(screen.getByText('Mine')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Replace with my version' }));
    expect(onResolve).toHaveBeenCalledWith('reapply');
    await userEvent.click(screen.getByRole('button', { name: 'Keep the latest version' }));
    expect(onResolve).toHaveBeenLastCalledWith('discard');
  });
  it('offers a safe re-apply when edits do not overlap, in French', () => {
    render(
      <LanguageProvider lang="fr">
        <ConflictDialog conflict={pending(false) as any} onResolve={() => {}} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button', { name: 'Réappliquer ma modification' })).toBeInTheDocument();
  });
});

describe('generated forms', () => {
  it('falls back to the guided interview for invalid or empty forms', () => {
    render(<GeneratedUIForm ui={[{ kind: 'script', questionId: 'x', label: 'x' }]} onSubmit={async () => {}} disabled={false} />);
    expect(screen.getByText(/Use the guided interview/)).toBeInTheDocument();
  });
});
