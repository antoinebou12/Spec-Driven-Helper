import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AnswerControl } from './AnswerControl';
import { SecurityChecklist } from './SecurityChecklist';
import { findQuestion } from '../../../../packages/shared/src/templates';
import { createSpec } from '../../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../../packages/shared/src/example';

const meta: Meta = { title: 'Specification/Rich controls' };
export default meta;
type Story = StoryObj;

function Answer({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const q = findQuestion(id)!;
  return (
    <div className="question-card">
      <h3 id={`${id}-label`}>{q.prompt.en}</h3>
      <AnswerControl id={id} question={q} value={value} onChange={setValue} />
    </div>
  );
}
export const Slider: Story = { render: () => <Answer id="quality.11" initial="99.9" /> };
export const SliderNotSet: Story = { render: () => <Answer id="quality.12" initial="" /> };
export const Matrix: Story = { render: () => <Answer id="security.14" initial={JSON.stringify({ 'Personal data': 'Confidential', Backups: 'Internal' })} /> };
export const SecurityChecklistComplete: Story = { render: () => <SecurityChecklist spec={buildExampleSpec('00000000-0000-4000-8000-0000000000e1')} /> };
export const SecurityChecklistEmpty: Story = { render: () => <SecurityChecklist spec={createSpec('00000000-0000-4000-8000-0000000000e2', 'New')} onOpenQuestion={() => {}} /> };
