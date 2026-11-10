import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OllamaStatus, type OllamaReport } from './OllamaStatus';

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
      contextLength: 4096,
      capabilities: ['completion'],
      parameterSize: '2.6B',
    },
    {
      name: 'nomic-embed-text:latest',
      size: 274_302_450,
      loaded: false,
      contextLength: 2048,
      capabilities: ['embedding'],
    },
  ],
  chatModel: { name: 'gemma2:2b', installed: true },
  embeddingModel: { name: 'mxbai-embed-large', installed: false },
};

describe('Ollama status panel', () => {
  it('checks on demand and lists models with their limits', async () => {
    const load = vi.fn(async () => connected);
    render(<OllamaStatus load={load} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(load).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Ollama 0.33.3');
    const row = screen.getByRole('row', { name: /gemma2:2b/ });
    expect(row).toHaveTextContent('1.6 GB');
    expect(row).toHaveTextContent('caps the window');
    expect(row).toHaveTextContent('Proposals');
    expect(screen.getByRole('row', { name: /nomic-embed-text/ })).toHaveTextContent('Embeddings');
    expect(screen.getByText('ollama pull mxbai-embed-large')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });

  it('explains an unreachable server and a failed check', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Administrator access required'));
    render(
      <OllamaStatus
        initial={{
          reachable: false,
          url: 'http://ollama:11434',
          numCtx: 8192,
          error: 'Ollama is unreachable',
        }}
        load={load}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Unreachable');
    expect(screen.getByRole('status')).toHaveTextContent('OLLAMA_URL');
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Administrator access required');
  });
});
