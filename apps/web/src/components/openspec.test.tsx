import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSpecImport, type OpenSpecPreview } from './OpenSpecExchange';
import { OpenSpecExport } from './OpenSpecExport';
import { LanguageProvider } from '../i18n';
import { api } from '../api';
import { readOpenSpecSelection } from '../openspec-files';

vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('../openspec-files', () => ({ readOpenSpecSelection: vi.fn() }));
const preview: OpenSpecPreview = {
  revision: 7,
  changes: [],
  diagnostics: [],
  sources: { 'design.md': '<script>untrusted</script>' },
  specification: { patch: {}, changes: [{ path: 'items.REQ-1', kind: 'added' }] },
  board: {
    enabled: true,
    revision: 3,
    added: ['TASK-1'],
    updated: [],
    cards: [
      {
        id: 'TASK-1',
        title: 'Implement',
        body: '',
        column: 'todo',
        group: '',
        sourceIds: [],
        assignee: '',
        obsolete: false,
        dependsOn: [],
        pullRequests: [],
      },
    ],
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readOpenSpecSelection).mockResolvedValue({ 'openspec/specs/scope/spec.md': 'source' });
});

it('previews without writes and confirms specification and board independently with revisions', async () => {
  vi.mocked(api).mockResolvedValue(preview);
  const reload = vi.fn().mockResolvedValue(undefined);
  render(<OpenSpecImport projectId="project" revision={7} editable reload={reload} go={vi.fn()} />);
  await userEvent.upload(
    screen.getByLabelText('OpenSpec ZIP'),
    new File(['zip'], 'spec.zip', { type: 'application/zip' }),
  );
  await screen.findByRole('button', { name: 'Propose' });
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenLastCalledWith(
    '/projects/project/openspec/import',
    'POST',
    expect.objectContaining({ preview: true, baseRevision: 7 }),
  );
  expect(reload).not.toHaveBeenCalled();
  vi.mocked(api).mockResolvedValue({ ...preview, proposalId: 'proposal' });
  await userEvent.click(screen.getByRole('button', { name: 'Propose' }));
  await screen.findByRole('button', { name: 'Review' });
  expect(api).toHaveBeenLastCalledWith(
    expect.anything(),
    'POST',
    expect.objectContaining({ preview: false, action: 'specification', baseRevision: 7 }),
  );
  await userEvent.click(screen.getByText('Tasks (1)'));
  await userEvent.click(screen.getByRole('button', { name: 'Import tasks' }));
  await screen.findByRole('button', { name: 'Imported' });
  expect(api).toHaveBeenLastCalledWith(
    expect.anything(),
    'POST',
    expect.objectContaining({ action: 'board', expectedBoardRevision: 3 }),
  );
});

it('requires change selection and blocks errors in French', async () => {
  vi.mocked(api).mockResolvedValue({
    ...preview,
    changes: ['one', 'two'],
    diagnostics: [
      {
        code: 'select',
        path: 'openspec',
        severity: 'error',
        en: 'Select a change',
        fr: 'Choisissez un changement',
      },
    ],
  });
  render(
    <LanguageProvider lang="fr">
      <OpenSpecImport projectId="project" revision={7} editable reload={vi.fn()} go={vi.fn()} />
    </LanguageProvider>,
  );
  await userEvent.upload(screen.getByLabelText('OpenSpec ZIP'), new File(['zip'], 'spec.zip'));
  expect(await screen.findByRole('button', { name: 'Proposer' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Changement' }), 'two');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith(
      expect.anything(),
      'POST',
      expect.objectContaining({ selectedChange: 'two', preview: true }),
    ),
  );
});

it('does not offer a download before diagnostics and labels incomplete exports as drafts', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<OpenSpecExport projectId="project" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  resolve({ revision: 7, draft: true, diagnostics: [] });
  expect(await screen.findByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/api/v1/projects/project/export/openspec?expectedRevision=7',
  );
  expect(screen.getByText(/Draft\./)).toBeVisible();
});

it('keeps read-only users from uploading files', () => {
  render(
    <OpenSpecImport
      projectId="project"
      revision={7}
      editable={false}
      reload={vi.fn()}
      go={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('OpenSpec ZIP')).toBeDisabled();
  expect(screen.getByLabelText('OpenSpec folder')).toBeDisabled();
});
