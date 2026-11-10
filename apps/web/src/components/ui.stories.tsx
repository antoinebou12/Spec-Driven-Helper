import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Badge, Button, EmptyState, Segmented, Switch, Tabs } from './ui';
import { ProgressBar, ProgressRing } from './Progress';
import { Splitter } from './Splitter';

const meta: Meta = { title: 'Primitives/Controls' };
export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="inline-actions">
      <Button variant="primary">
        <Sparkles size={15} /> Primary
      </Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button size="sm">Small</Button>
      <Button size="icon" aria-label="Add">
        <Plus size={16} />
      </Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="inline-actions">
      {['neutral', 'blue', 'green', 'amber', 'red', 'violet'].map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const TabsAndSegmented: Story = {
  render: function Render() {
    const [tab, setTab] = useState('preview');
    const [state, setState] = useState('answered');
    return (
      <div className="form-stack">
        <Tabs label="Document views" value={tab} onChange={setTab} items={[{ id: 'preview', label: 'Preview' }, { id: 'edit', label: 'Edit' }, { id: 'history', label: 'History', count: 3 }]} />
        <Segmented
          label="Answer status"
          value={state}
          onChange={setState}
          items={[
            { id: 'answered', label: 'Answer' },
            { id: 'unknown', label: 'Unknown for now' },
            { id: 'not-applicable', label: 'Does not apply' },
          ]}
        />
      </div>
    );
  },
};

export const Switches: Story = {
  render: function Render() {
    const [on, setOn] = useState(true);
    return (
      <div className="form-stack">
        <Switch checked={on} onChange={setOn} label="Prefer LTS versions" description="New selections use the latest long-term-support release." />
        <Switch checked={false} onChange={() => {}} label="Disabled" disabled />
      </div>
    );
  },
};

export const Progress: Story = {
  render: () => (
    <div className="inline-actions" style={{ alignItems: 'center', gap: 24 }}>
      <ProgressRing value={78} size={120} stroke={10} label="Document completeness" />
      <ProgressRing value={100} tone="green" label="Required answers" />
      <div style={{ width: 240 }}>
        <ProgressBar value={45} label="Optional answers" />
      </div>
    </div>
  ),
};

export const ResizableDivider: Story = {
  render: function Render() {
    const [width, setWidth] = useState(240);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${width}px 6px 1fr`, height: 160, border: '1px solid var(--line)' }}>
        <div style={{ padding: 12 }}>Panel ({width}px) — focus the divider and use ← →</div>
        <Splitter label="Resize panel" value={width} min={160} max={420} onChange={setWidth} />
        <div style={{ padding: 12 }}>Content</div>
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <EmptyState title="Nothing to review">
      <p className="muted">AI runs, Git imports and document imports appear here.</p>
    </EmptyState>
  ),
};
