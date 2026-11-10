import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnswerRecord, InterviewChoiceCard } from './AnswerRecord';
import { QuestionCard } from './QuestionCard';
import { createSpec } from '../../../../../packages/shared/src/domain';
import { findQuestion, modules, moduleQuestions, type Question } from '../../../../../packages/shared/src/templates';

const meta: Meta = { title: 'Builder/Guided interview', decorators: [(Story) => <div className="builder" style={{ maxWidth: 460 }}><Story /></div>] };
export default meta;
type Story = StoryObj;

const spec = createSpec('00000000-0000-4000-8000-0000000000f6', 'New', 'en', false, 'Web application');
const byKind = (kind: Question['kind']) => modules.flatMap((m) => moduleQuestions(m, spec)).find((q) => q.kind === kind && q.required)!;
const ok = async () => true;
const noop = () => {};
const card = (question: Question, extra: Partial<Parameters<typeof QuestionCard>[0]> = {}) => <QuestionCard question={question} spec={spec} editable aiAvailable onSave={ok} onRespond={noop} onOpenEditor={noop} {...extra} />;

export const Text: Story = { render: () => card(findQuestion('discovery.1')!) };
export const Choice: Story = { render: () => card(byKind('choice')) };
export const YesNo: Story = { render: () => card(byKind('switch')) };
export const Multiple: Story = { render: () => card(byKind('multi')) };
export const Slider: Story = { render: () => card(byKind('slider')) };
export const Grid: Story = { render: () => card(byKind('matrix')) };
export const Table: Story = { render: () => card(findQuestion('discovery.3')!) };
export const Requirements: Story = { render: () => card(byKind('requirements')) };
export const WithoutAI: Story = { render: () => card(findQuestion('discovery.1')!, { aiAvailable: false }) };
export const ReadOnly: Story = { render: () => card(findQuestion('discovery.1')!, { editable: false }) };
export const Answered: Story = { render: () => <AnswerRecord question={findQuestion('discovery.1')} result={{ action: 'answered', questionId: 'discovery.1', summary: 'Support agents lose requests in long email threads.' }} /> };
export const Skipped: Story = { render: () => <AnswerRecord question={findQuestion('discovery.2')} result={{ action: 'skipped', questionId: 'discovery.2' }} /> };
export const NotApplicable: Story = { render: () => <AnswerRecord question={findQuestion('discovery.5')} result={{ action: 'not-applicable', questionId: 'discovery.5', reason: 'Internal tool with no revenue model' }} /> };
export const WrapUp: Story = {
  render: () => (
    <InterviewChoiceCard
      options={[
        { key: 'go-optional', label: 'Answer the optional questions' },
        { key: 'stop', label: 'I’m done for now' },
      ]}
      onPick={noop}
    />
  ),
};
