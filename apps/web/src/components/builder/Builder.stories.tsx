import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChoiceCard, ProposalCard, ScaleCard, StackPickCard, TextCard } from './BuilderCards';
import { LiveDocument } from './LiveDocument';
import { buildExampleSpec } from '../../../../../packages/shared/src/example';
import { createSpec } from '../../../../../packages/shared/src/domain';
import type { Technology } from '../../../../../packages/shared/src/schema';

const meta: Meta = { title: 'Builder/Conversation and live document', decorators: [(Story) => <div className="builder" style={{ maxWidth: 900 }}><Story /></div>] };
export default meta;
type Story = StoryObj;

const catalog = [
  { id: 't1', name: 'React', category: 'framework', tags: ['react'], version: '19', versions: [{ version: '19', lts: true, latest: true, support: '' }] },
  { id: 't2', name: 'PostgreSQL', category: 'database', tags: ['postgresql'], version: '17', versions: [{ version: '17', lts: true, latest: true, support: '' }] },
  { id: 't3', name: 'Fastify', category: 'framework', tags: ['fastify'], version: '5', versions: [{ version: '5', lts: true, latest: true, support: '' }] },
] as unknown as Technology[];
const noop = async () => {};

export const Choice: Story = { render: () => <ChoiceCard question="Who uses the portal first?" options={['Support agents', 'Customers', 'Team leads']} onAnswer={() => {}} /> };
export const MultipleChoice: Story = { render: () => <ChoiceCard question="Which channels matter?" options={['Email', 'Web form', 'Chat']} multiple onAnswer={() => {}} /> };
export const Slider: Story = { render: () => <ScaleCard question="Availability target" min={95} max={99.99} step={0.01} unit="%" suggestion={99.9} onAnswer={() => {}} /> };
export const FreeText: Story = { render: () => <TextCard question="What must never happen?" placeholder="For example: a request is lost" onAnswer={() => {}} /> };
export const Answered: Story = { render: () => <ChoiceCard question="Who uses the portal first?" options={['Support agents', 'Customers']} answered="Support agents" onAnswer={() => {}} /> };
export const StackPicker: Story = { render: () => <StackPickCard question="Pick the stack" suggestions={['React', 'PostgreSQL']} catalog={catalog} current={[]} lang="en" editable onSave={() => {}} /> };
export const ProposalPending: Story = { render: () => <ProposalCard proposal={{ proposalId: 'p1', title: 'Problem statement', changes: 2, status: 'pending' }} canReview onAccept={noop} onReject={noop} onOpen={() => {}} /> };
export const ProposalAccepted: Story = { render: () => <ProposalCard proposal={{ proposalId: 'p1', title: 'Problem statement', changes: 2, status: 'accepted' }} canReview onAccept={noop} onReject={noop} onOpen={() => {}} /> };

function Document({ example }: { example: boolean }) {
  const [focus, setFocus] = useState<string | null>(example ? 'discovery' : null);
  const spec = example ? buildExampleSpec('00000000-0000-4000-8000-0000000000f1') : createSpec('00000000-0000-4000-8000-0000000000f2', 'New');
  return <LiveDocument spec={spec} editable focus={focus} onFocus={setFocus} onSave={async () => true} onAnswer={() => {}} onOpen={() => {}} />;
}
export const LiveDocumentExample: Story = { render: () => <Document example /> };
export const LiveDocumentNew: Story = { render: () => <Document example={false} /> };
