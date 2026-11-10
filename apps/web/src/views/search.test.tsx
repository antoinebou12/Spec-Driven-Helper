import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';
import { LanguageProvider } from '../i18n';
import Search from './Search';

const api = vi.fn();
vi.mock('../api', () => ({ api: (...args: unknown[]) => api(...args) }));
const project = {
  spec: createSpec('00000000-0000-4000-8000-000000000001', 'Search project'),
  role: 'Owner',
} as ProjectState;
beforeEach(() => api.mockReset());

it('searches the current project and navigates to a localized section', async () => {
  api.mockResolvedValue({
    results: [
      {
        section_id: 'discovery',
        title: 'discovery',
        revision: 2,
        excerpt: 'Customer request portal',
      },
    ],
  });
  const go = vi.fn();
  render(<Search project={project} go={go} />);
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  await userEvent.type(screen.getByRole('searchbox'), ' customer & portal ');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(api).toHaveBeenCalledWith(
    `/projects/${project.spec!.id}/search?q=customer%20%26%20portal&semantic=false`,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Business & discovery' }));
  expect(go).toHaveBeenCalledWith('specification', { sectionId: 'discovery' });
});

it('shows empty and failure states without stale results, and hides indexing from viewers', async () => {
  api.mockResolvedValueOnce({ results: [] }).mockRejectedValueOnce(new Error('Search unavailable'));
  render(<Search project={{ ...project, role: 'Viewer' }} go={() => {}} />);
  expect(screen.queryByText('Semantic index')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'nothing');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('No matching sections.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('keeps indexing inside a disclosure and reports its result in French', async () => {
  api.mockResolvedValue({ indexed: 14 });
  render(
    <LanguageProvider lang="fr">
      <Search project={project} go={() => {}} />
    </LanguageProvider>,
  );
  await userEvent.click(screen.getByText('Index sémantique'));
  await userEvent.click(screen.getByRole('button', { name: 'Reconstruire l’index' }));
  expect(await screen.findByText('14 sections indexées.')).toBeVisible();
  expect(api).toHaveBeenCalledWith(`/projects/${project.spec!.id}/search/index`, 'POST');
});
