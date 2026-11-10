import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { UseCaseEditor } from './UseCaseEditor';

const meta: Meta<typeof UseCaseEditor> = { title: 'Specification/Use case editor', component: UseCaseEditor };
export default meta;
type Story = StoryObj<typeof UseCaseEditor>;

function Stateful({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <UseCaseEditor value={value} onChange={setValue} />;
}
export const Empty: Story = { render: () => <Stateful initial="" /> };
export const Complete: Story = {
  render: () => (
    <Stateful initial={'**Actor:** Customer\n\n**Trigger:** Needs help with an order\n\n### Main flow\n\n1. Opens a new request\n2. Chooses a category\n\n### Alternate flows and edge cases\n\n- Attachment too large: the limit is explained\n\n### Outcome\n\n- The request has an ID'} />
  ),
};
export const FreeText: Story = { render: () => <Stateful initial="The customer asks for help and the system records it." /> };
