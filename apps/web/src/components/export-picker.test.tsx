import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPicker } from './ExportPicker';

it('groups formats, changes the download without navigating, and falls back when a format disappears', async () => {
  const formats = [
    { id: 'zip', title: 'Bundle', note: 'Agent files' },
    { id: 'pdf', title: 'PDF', note: 'PDF report' },
  ];
  const groups = [
    { id: 'agents', title: 'Coding agents', ids: ['zip'] },
    { id: 'documents', title: 'Documents', ids: ['pdf'] },
  ];
  const { rerender } = render(
    <ExportPicker projectId="project" formats={formats} groups={groups} />,
  );
  expect(screen.getByRole('group', { name: 'Documents' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/api/v1/projects/project/export/zip',
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Export format' }), 'pdf');
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/api/v1/projects/project/export/pdf',
  );
  expect(screen.getByText('PDF report')).toBeVisible();
  expect(screen.queryByText('Agent files')).not.toBeInTheDocument();
  rerender(<ExportPicker projectId="project" formats={formats.slice(0, 1)} groups={groups} />);
  expect(screen.getByRole('combobox')).toHaveValue('zip');
  expect(screen.queryByRole('option', { name: 'PDF' })).not.toBeInTheDocument();
});
