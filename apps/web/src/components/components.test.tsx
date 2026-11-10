import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented, Switch, Tabs } from './ui';
import { AnswerControl } from './AnswerControl';
import { ProgressRing } from './Progress';
import { Splitter } from './Splitter';
import { Tour } from './Tour';
import { FeatureFlagsPanel } from './FeatureFlags';
import { effectiveFeatures, featureFlags } from '../../../../packages/shared/src/feature-flags';
import { LicenseCheck } from './LicenseCheck';
import { TechIcon } from './TechIcon';
import { FeaturesProvider, useFeatures } from '../features';
import { technologyCategories, type Technology } from '../../../../packages/shared/src/schema';
import { LanguageProvider } from '../i18n';
import { findQuestion } from '../../../../packages/shared/src/templates';

function Controlled({ initial, render: view }: { initial: string; render: (v: string, set: (v: string) => void) => React.ReactNode }) {
  const [value, setValue] = useState(initial);
  return <>{view(value, setValue)}</>;
}

describe('keyboard-operable primitives', () => {
  it('moves between tabs with arrow keys and keeps a single tab stop', async () => {
    const user = userEvent.setup();
    render(
      <Controlled
        initial="a"
        render={(v, set) => (
          <Tabs label="Views" value={v} onChange={set} items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }]} />
        )}
      />,
    );
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').filter((t) => t.tabIndex === 0)).toHaveLength(1);
    alpha.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });
  it('exposes segmented controls as a radio group', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Status" value="yes" onChange={onChange} items={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />);
    expect(screen.getByRole('radiogroup', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(onChange).toHaveBeenCalledWith('no');
  });
  it('toggles a switch with the keyboard and names it from its label', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="off" render={(v, set) => <Switch label="Prefer LTS" description="Uses long-term support" checked={v === 'on'} onChange={(on) => set(on ? 'on' : 'off')} />} />);
    const toggle = screen.getByRole('switch', { name: 'Prefer LTS' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription('Uses long-term support');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
  it('resizes a splitter with arrow keys within its bounds', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="300" render={(v, set) => <Splitter label="Resize" value={Number(v)} min={200} max={320} onChange={(n) => set(String(n))} />} />);
    const splitter = screen.getByRole('separator', { name: 'Resize' });
    splitter.focus();
    await user.keyboard('{ArrowRight}');
    expect(splitter).toHaveAttribute('aria-valuenow', '316');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(splitter).toHaveAttribute('aria-valuenow', '320');
    await user.keyboard('{Home}');
    expect(splitter).toHaveAttribute('aria-valuenow', '200');
  });
  it('reports progress to assistive technology', () => {
    render(<ProgressRing value={42.4} label="Completeness" />);
    const ring = screen.getByRole('progressbar', { name: 'Completeness' });
    expect(ring).toHaveAttribute('aria-valuenow', '42');
    expect(ring).toHaveTextContent('42%');
  });
});

describe('answer controls', () => {
  it('stores multi-select answers as option values and shows localized labels', async () => {
    const question = findQuestion('data.11')!;
    const onChange = vi.fn();
    render(
      <LanguageProvider lang="fr">
        <AnswerControl id="q" question={question} value={JSON.stringify(['OpenAPI'])} onChange={onChange} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'OpenAPI' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'JSON Schema' }));
    expect(onChange).toHaveBeenCalledWith(JSON.stringify(['OpenAPI', 'JSON Schema']));
  });
  it('names choice and text answers from the question heading', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const choice = findQuestion('delivery.11')!;
    const text = findQuestion('discovery.1')!;
    render(
      <>
        <h3 id="c-label">{choice.prompt.en}</h3>
        <AnswerControl id="c" question={choice} value="" onChange={onChange} />
        <h3 id="t-label">{text.prompt.en}</h3>
        <AnswerControl id="t" question={text} value="" onChange={() => {}} />
      </>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: choice.prompt.en }), 'GitHub Actions');
    expect(onChange).toHaveBeenCalledWith('GitHub Actions');
    expect(screen.getByRole('textbox', { name: text.prompt.en })).toBeInTheDocument();
  });

  it('answers switch questions with yes or no', async () => {
    const question = findQuestion('security.12')!;
    const onChange = vi.fn();
    render(<AnswerControl id="mfa" question={question} value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Answer no' }));
    expect(onChange).toHaveBeenLastCalledWith('no');
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith('yes');
  });
  it('edits table answers cell by cell with labelled inputs', async () => {
    const question = findQuestion('discovery.3')!;
    const onChange = vi.fn();
    render(<AnswerControl id="t" question={question} value={JSON.stringify([['Sponsor', '', '']])} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Interest 1' }), 'X');
    expect(onChange).toHaveBeenLastCalledWith(JSON.stringify([['Sponsor', 'X', '']]));
    await userEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(onChange).toHaveBeenLastCalledWith(JSON.stringify([['Sponsor', '', ''], ['', '', '']]));
    expect(screen.getByRole('button', { name: 'Remove row 1' })).toBeDisabled();
  });
});

describe('guided tour', () => {
  it('steps forward and back, then closes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Tour
        open
        onClose={onClose}
        steps={[
          { title: 'Welcome', body: 'First' },
          { title: 'Projects', body: 'Second' },
        ]}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Welcome' })).toHaveTextContent('Step 1 of 2');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('dialog', { name: 'Projects' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Welcome' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('feature flag administration', () => {
  it('keeps switches as a draft and saves only the changed features', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const catalog = featureFlags.map(({ id, category, label, description, defaultEnabled }) => ({ id, category, label, description, defaultEnabled }));
    render(
      <LanguageProvider lang="en">
        <FeatureFlagsPanel catalog={catalog} value={effectiveFeatures({ mcp: false })} onSave={onSave} />
      </LanguageProvider>,
    );
    const save = screen.getByRole('button', { name: /No changes/ });
    expect(save).toBeDisabled();
    const board = screen.getByRole('switch', { name: /Implementation board/ });
    expect(board).toHaveAttribute('aria-checked', 'true');
    board.focus();
    await user.keyboard(' ');
    expect(board).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('switch', { name: /MCP server/ }));
    await user.click(screen.getByRole('button', { name: /Save 2 changes/ }));
    expect(onSave).toHaveBeenCalledWith({ board: false, mcp: true });
  });
});

describe('feature flag drafts and context', () => {
  const catalog = featureFlags.map(({ id, category, label, description, defaultEnabled }) => ({ id, category, label, description, defaultEnabled }));

  it('restores defaults as a draft and disables saving while a save is in flight', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <LanguageProvider lang="en">
        <FeatureFlagsPanel catalog={catalog} value={effectiveFeatures({ mcp: false, board: false })} onSave={onSave} />
      </LanguageProvider>,
    );
    expect(screen.getByText(`${catalog.length - 2} of ${catalog.length} on`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Restore defaults/ }));
    expect(screen.getAllByText('unsaved')).toHaveLength(2);
    const save = screen.getByRole('button', { name: /Save 2 changes/ });
    await user.click(save);
    expect(onSave).toHaveBeenCalledWith({ mcp: true, board: true });
    expect(save).toBeDisabled();
    expect(screen.getByRole('button', { name: /Restore defaults/ })).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: /Save 2 changes/ })).toBeEnabled();
  });

  it('exposes hidden views and lets a save replace the state', async () => {
    const user = userEvent.setup();
    function Probe() {
      const features = useFeatures();
      return (
        <>
          <output aria-label="hidden">{[...features.hidden].sort().join(',')}</output>
          <output aria-label="ai">{String(features.on('ai'))}</output>
          <button onClick={() => features.replace({ ai: false })}>Turn AI off</button>
        </>
      );
    }
    render(
      <FeaturesProvider initial={{ board: false, catalog: false }}>
        <Probe />
      </FeaturesProvider>,
    );
    // The catalog flag only guards catalog editing; it no longer hides a view (the radar was removed).
    expect(screen.getByLabelText('hidden')).toHaveTextContent(/^board$/);
    expect(screen.getByLabelText('ai')).toHaveTextContent('true');
    await user.click(screen.getByRole('button', { name: 'Turn AI off' }));
    expect(screen.getByLabelText('ai')).toHaveTextContent('false');
    expect(screen.getByLabelText('hidden')).not.toHaveTextContent('board');
  });
});

describe('technology icons', () => {
  it('draws a brand mark in its colour when Simple Icons has one', () => {
    const { container } = render(<TechIcon technology={{ icon: 'opentofu', category: 'iac' }} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('style')).toMatch(/color: (#|rgb)/);
    expect(svg.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });

  it('falls back to a distinct category icon for every category', () => {
    const icons = technologyCategories.map((category) => {
      const { container, unmount } = render(<TechIcon technology={{ icon: 'no-such-brand', category }} />);
      const svg = container.querySelector('svg')!;
      expect(svg, category).toHaveClass('tech-icon');
      const name = [...svg.classList].find((c) => c.startsWith('lucide-'));
      unmount();
      return `${name}`;
    });
    expect(icons.filter((name) => name === 'lucide-wrench')).toHaveLength(1);
    expect(icons[technologyCategories.indexOf('iac')]).not.toBe(icons[technologyCategories.indexOf('cloud')]);
  });
});

describe('license check', () => {
  const tech = (name: string, license: string, category: Technology['category']) => ({ id: name, name, license, category, icon: '' }) as Technology;
  const stack = [tech('ReadLine', 'GPL-3.0', 'library'), tech('React', 'MIT', 'framework')];

  it('explains blocking findings for the recorded policy', () => {
    render(
      <LanguageProvider lang="fr">
        <LicenseCheck technologies={stack} policy={{ projectLicense: 'Proprietary (all rights reserved)', distribution: 'Distributed binaries or installers', allowed: [] }} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('heading', { name: /Vérification des licences/ })).toBeInTheDocument();
    expect(screen.getByText('1 bloquant(s)')).toBeInTheDocument();
    expect(screen.getByText(/exige de publier le code combiné sous GPL/)).toBeInTheDocument();
    expect(screen.getByText('Copyleft fort')).toBeInTheDocument();
  });

  it('asks for the governance answers when no policy is recorded', () => {
    render(
      <LanguageProvider lang="en">
        <LicenseCheck technologies={stack} policy={{ projectLicense: '', distribution: '', allowed: [] }} />
      </LanguageProvider>,
    );
    expect(screen.getByText('No conflicts found')).toBeInTheDocument();
    expect(screen.getByText(/in the Governance section/)).toBeInTheDocument();
  });
});
