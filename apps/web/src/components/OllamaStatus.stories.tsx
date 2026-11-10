import type { Meta, StoryObj } from '@storybook/react-vite';
import { OllamaStatus, type OllamaReport } from './OllamaStatus';

const meta: Meta = { title: 'Administration/Ollama status' };
export default meta;
type Story = StoryObj;

const connected: OllamaReport = {
  reachable: true,
  url: 'http://127.0.0.1:11434',
  version: '0.33.3',
  numCtx: 8192,
  models: [
    {
      name: 'gemma2:2b',
      size: 1_629_518_495,
      loaded: true,
      contextLength: 8192,
      capabilities: ['completion'],
      parameterSize: '2.6B',
    },
    {
      name: 'nomic-embed-text:latest',
      size: 274_302_450,
      loaded: false,
      contextLength: 2048,
      capabilities: ['embedding'],
      parameterSize: '137M',
    },
    {
      name: 'qwen2.5:7b',
      size: 4_683_087_332,
      loaded: false,
      contextLength: 32768,
      capabilities: ['completion', 'tools'],
      parameterSize: '7.6B',
    },
  ],
  chatModel: { name: 'gemma2:2b', installed: true },
  embeddingModel: { name: 'nomic-embed-text', installed: true },
};

export const Connected: Story = {
  render: () => <OllamaStatus initial={connected} load={async () => connected} />,
};
export const MissingModel: Story = {
  render: () => (
    <OllamaStatus
      initial={{
        ...connected,
        models: connected.models.slice(0, 1),
        embeddingModel: { name: 'nomic-embed-text', installed: false },
      }}
      load={async () => connected}
    />
  ),
};
export const Unreachable: Story = {
  render: () => (
    <OllamaStatus
      initial={{
        reachable: false,
        url: 'http://ollama:11434',
        numCtx: 8192,
        error: 'Ollama is unreachable',
      }}
      load={async () => connected}
    />
  ),
};
export const NotCheckedYet: Story = { render: () => <OllamaStatus load={async () => connected} /> };
