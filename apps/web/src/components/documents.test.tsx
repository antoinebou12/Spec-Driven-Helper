import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SddWorkflow } from './SddWorkflow';
import { OverviewImage, imageFileName } from './OverviewImage';
import { ConventionsGuide } from './ConventionsGuide';
import { FeaturesProvider } from '../features';
import { LanguageProvider } from '../i18n';
import { createSpec } from '../../../../packages/shared/src/domain';
import { languagesForStack } from '../../../../packages/shared/src/conventions';
import { sddPhases } from '../../../../packages/shared/src/spec-kit';

const id = '00000000-0000-4000-8000-000000000001';

describe('spec-driven workflow card', () => {
  it('lists every phase, marks the current one and opens its view', async () => {
    const go = vi.fn();
    render(<SddWorkflow spec={createSpec(id, 'New')} go={go} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(sddPhases.length);
    expect(items.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(screen.getByText('/speckit.constitution')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open Constitution/ }));
    expect(go).toHaveBeenCalledWith('specification', { sectionId: 'governance' });
    await userEvent.click(screen.getByRole('button', { name: /Open Converge/ }));
    expect(go).toHaveBeenLastCalledWith('import');
    await userEvent.click(screen.getByRole('button', { name: /flow-forward, flow-back or living/ }));
    expect(go).toHaveBeenLastCalledWith('specification', { sectionId: 'governance', questionId: 'governance.12' });
  });
  it('disables phases whose view an administrator turned off', () => {
    render(
      <FeaturesProvider initial={{ board: false }}>
        <SddWorkflow spec={createSpec(id, 'New')} go={() => {}} />
      </FeaturesProvider>,
    );
    expect(screen.getByRole('button', { name: /Open Tasks/ })).toBeDisabled();
  });
  it('shows the chosen persistence model', () => {
    const spec = createSpec(id, 'New');
    spec.sections.find((s) => s.id === 'governance')!.answers['governance.12'] = { value: 'Living specification (kept in sync, drift checked)', state: 'answered', reason: '' } as any;
    render(<SddWorkflow spec={spec} go={() => {}} />);
    expect(screen.getByText('Living specification (kept in sync, drift checked)')).toBeInTheDocument();
  });
});

describe('overview image card', () => {
  it('previews the image with a description and offers SVG and PNG downloads', () => {
    render(<OverviewImage src="/api/v1/projects/p/export/svg" name="My Spec-r3" />);
    expect(screen.getByRole('img', { name: /readiness, completeness per module and stack/ })).toHaveAttribute('src', '/api/v1/projects/p/export/svg');
    expect(screen.getByRole('link', { name: /SVG/ })).toHaveAttribute('download', 'my-spec-r3-overview.svg');
    expect(screen.getByRole('button', { name: /PNG/ })).toBeEnabled();
  });
  it('reports a failed PNG conversion', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    render(<OverviewImage src="/x.svg" name="x" />);
    await userEvent.click(screen.getByRole('button', { name: /PNG/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
    fetchMock.mockRestore();
  });
  it('builds safe file names', () => {
    expect(imageFileName('Café / Spec: r2', 'png')).toBe('cafe-spec-r2-overview.png');
    expect(imageFileName('***', 'svg')).toBe('overview-overview.svg');
  });
});

describe('conventions guide', () => {
  it('switches language and converts identifiers between case styles', async () => {
    render(
      <LanguageProvider lang="en">
        <ConventionsGuide languages={languagesForStack(['typescript', 'python'])} />
      </LanguageProvider>,
    );
    const python = screen.getByRole('button', { name: /Python/ });
    await userEvent.click(python);
    expect(python).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('snake_case').length).toBeGreaterThan(0);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'orderLineItem');
    expect(screen.getByText('order_line_item')).toBeInTheDocument();
    expect(screen.getByText('order-line-item')).toBeInTheDocument();
  });
});
