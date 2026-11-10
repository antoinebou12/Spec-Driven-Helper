import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AnswerControl } from './AnswerControl';
import { ConflictDialog } from './ConflictDialog';
import { Diagram, Markdown } from './Markdown';
import { TechIcon } from './TechIcon';
import { Tour } from './Tour';
import { findQuestion, modules } from '../../../../packages/shared/src/templates';
import type { Technology } from '../../../../packages/shared/src/schema';

const meta: Meta = { title: 'Specification/Components' };
export default meta;
type Story = StoryObj;

function Answer({ questionId, initial }: { questionId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const question = findQuestion(questionId)!;
  return (
    <div className="question-card">
      <h3 id={`${questionId}-label`}>{question.prompt.en}</h3>
      <AnswerControl id={questionId} question={question} value={value} onChange={setValue} />
      <pre className="small muted">{value}</pre>
    </div>
  );
}

export const TextAnswer: Story = { render: () => <Answer questionId="discovery.1" initial="Customers lose track of service requests." /> };
export const MultiSelectAnswer: Story = { render: () => <Answer questionId="data.10" initial={JSON.stringify(['Synchronous REST over HTTP'])} /> };
export const SwitchAnswer: Story = { render: () => <Answer questionId="security.12" initial="yes" /> };
export const ChoiceAnswer: Story = { render: () => <Answer questionId="delivery.11" initial="GitHub Actions" /> };
export const RequirementsTable: Story = {
  render: () => <Answer questionId="scope.3" initial={JSON.stringify([['REQ-001', 'Customers submit a request', 'Must', 'ID within 2 seconds']])} />,
};
export const RaciMatrix: Story = {
  render: () => <Answer questionId="governance.1" initial={JSON.stringify([['Approve baseline', 'Tech lead', 'Product owner', 'Security', 'Support']])} />,
};

export const TechnologyIcons: Story = {
  render: () => {
    const samples: Pick<Technology, 'icon' | 'category' | 'name'>[] = [
      { name: 'React', icon: 'react', category: 'framework' },
      { name: 'Django', icon: 'django', category: 'framework' },
      { name: 'Kotlin', icon: 'kotlin', category: 'language' },
      { name: 'Next.js', icon: 'nextdotjs', category: 'framework' },
      { name: 'C# (fallback icon)', icon: '', category: 'language' },
      { name: 'Azure (fallback icon)', icon: '', category: 'cloud' },
    ];
    return (
      <ul className="tech-list" style={{ maxWidth: 320 }}>
        {samples.map((t) => (
          <li key={t.name} className="tech-card">
            <TechIcon technology={t} size={20} />
            <span className="tech-name">{t.name}</span>
          </li>
        ))}
      </ul>
    );
  },
};

export const MarkdownAndDiagram: Story = {
  render: () => (
    <>
      <Markdown text={'# Scope\n\n| ID | Requirement |\n| --- | --- |\n| REQ-001 | Submit a request |\n\n> Answer blocks are hidden in previews.'} />
      <Diagram code={modules.find((m) => m.id === 'workflows')!.diagram} />
    </>
  ),
};

export const GuidedTour: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" data-tour="demo" className="button primary" onClick={() => setOpen(true)}>
          Highlighted control
        </button>
        <Tour
          open={open}
          onClose={() => setOpen(false)}
          steps={[
            { title: 'Welcome', body: 'Centered step without a target.' },
            { target: 'demo', title: 'A highlighted control', body: 'Steps with a target spotlight that element.' },
          ]}
        />
      </>
    );
  },
};

export const StaleEditConflict: Story = {
  render: () => (
    <ConflictDialog
      onResolve={() => {}}
      conflict={{
        label: 'Problem to solve',
        patch: {},
        info: {
          baseRevision: 4,
          currentRevision: 5,
          overlapping: true,
          conflicts: [
            {
              path: 'sections.discovery.answers.discovery.1',
              current: { value: 'First author wording.', state: 'answered', reason: '' },
              yours: { value: 'Second author wording.', state: 'answered', reason: '' },
            },
          ],
        },
      }}
    />
  ),
};
