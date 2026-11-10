import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { buildExampleSpec } from '../packages/shared/src/example';
import { createSpec } from '../packages/shared/src/domain';
import {
  cleanModelPatch,
  compactRunContext,
  focusSections,
  localOutputSchema,
  localResultToProposal,
  localSystemPrompt,
} from '../apps/api/src/local-context';
import { generate, grammarSchema, ProviderError, systemPrompt } from '../apps/api/src/providers';
import {
  clearOllamaCache,
  ollamaContextWindow,
  ollamaNumCtx,
  ollamaStatus,
} from '../apps/api/src/ollama';

const example = () => buildExampleSpec('00000000-0000-4000-8000-000000000001');
const keys = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keys)
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)])
      : [];

describe('compact context for local models', () => {
  it('focuses on sections named by title in either language or by question id', () => {
    const spec = example();
    expect(focusSections(spec, 'Review the “Security & privacy” section.')).toEqual(['security']);
    expect(focusSections(spec, 'Révisez la section « Sécurité et confidentialité ».')).toEqual([
      'security',
    ]);
    expect(focusSections(spec, 'Improve governance.12 please')).toEqual(['governance']);
  });

  it('focuses on a section named by a single word of its title', () => {
    const spec = example();
    expect(
      focusSections(spec, 'Propose answers for the open questions in Operations & support.'),
    ).toEqual(['operations']);
    expect(focusSections(spec, 'Complétez la sécurité')).toEqual(['security']);
    expect(focusSections(spec, 'Add some data please')).not.toEqual(['data']);
  });

  it('falls back to the sections with the most open questions, even when everything required is answered', () => {
    const blank = createSpec('00000000-0000-4000-8000-000000000002', 'Blank');
    expect(focusSections(blank, 'Help me start')).toHaveLength(3);
    const full = example();
    const focus = focusSections(full, 'Help me');
    expect(focus.length).toBeGreaterThan(0);
  });

  it('fits the budget, keeps every item id and lists the open questions of the focus', () => {
    const spec = example();
    const security = spec.sections.find((s) => s.id === 'security')!;
    delete security.answers['security.2'];
    const { text, focus, questions } = compactRunContext(
      spec,
      'Review the “Security & privacy” section.',
      {},
      12_000,
    );
    expect(text.length).toBeLessThanOrEqual(12_000);
    expect(focus).toEqual(['security']);
    const parsed = JSON.parse(text);
    expect(parsed.openQuestions).toContain('security.2');
    expect(questions).toContain('security.2');
    expect(questions.every((id) => id.startsWith('security.'))).toBe(true);
    const ids = JSON.stringify(parsed.specification.items);
    for (const item of spec.items) expect(ids).toContain(item.id);
  });

  it('shortens answers further for small budgets and bounds imported material', () => {
    const spec = example();
    const material = { 'imported/readme.md': 'x'.repeat(50_000) };
    const roomy = compactRunContext(spec, 'Review “Security & privacy”', material, 30_000);
    const tight = compactRunContext(spec, 'Review “Security & privacy”', material, 6_000);
    expect(roomy.text.length).toBeLessThanOrEqual(30_000);
    expect(JSON.parse(roomy.text).importedMaterial['imported/readme.md'].length).toBeGreaterThan(
      1000,
    );
    expect(tight.text.length).toBeLessThanOrEqual(6_000);
    expect(
      JSON.parse(tight.text).importedMaterial?.['imported/readme.md'].length ?? 0,
    ).toBeLessThan(1000);
  });
});

describe('cleaning model answers', () => {
  it('drops echoed answers and answers to questions that do not exist', () => {
    const spec = example();
    const existing = spec.sections.find((s) => s.id === 'security')!.answers['security.1'].value;
    const { patch, echoed, unknown } = cleanModelPatch(spec, {
      sections: [
        {
          id: 'security',
          answers: {
            'security.1': {
              value: ` ${existing} `,
              state: 'unknown',
              reason: 'Please provide more',
            },
            'security.2': { value: 'STRIDE per trust boundary', state: 'answered', reason: '' },
            title: { value: 'Security & privacy', state: 'answered', reason: '' },
          },
        },
        { id: 'quality', answers: { reason: { value: 'x', state: 'answered', reason: '' } } },
      ],
    });
    expect(echoed).toBe(1);
    expect(unknown).toBe(2);
    expect(patch.sections).toEqual([
      {
        id: 'security',
        answers: { 'security.2': expect.objectContaining({ value: 'STRIDE per trust boundary' }) },
      },
    ]);
  });

  it('never lets an unknown or not-applicable answer replace a recorded one', () => {
    const spec = example();
    const security = spec.sections.find((s) => s.id === 'security')!;
    delete security.answers['security.2'];
    const { patch, downgraded } = cleanModelPatch(spec, {
      sections: [
        {
          id: 'security',
          answers: {
            'security.1': {
              value: '',
              state: 'unknown',
              reason: 'Missing information on classification',
            },
            'security.3': { value: 'n/a', state: 'not-applicable', reason: '' },
            'security.2': { value: '', state: 'unknown', reason: 'Threat model not defined yet' },
            'security.5': { value: 'Rotate secrets every 30 days', state: 'answered', reason: '' },
          },
        },
      ],
    });
    expect(downgraded).toBe(2);
    expect(Object.keys(patch.sections?.[0].answers ?? {}).sort()).toEqual([
      'security.2',
      'security.5',
    ]);
  });

  it('keeps answers to custom questions proposed in the same patch', () => {
    const spec = example();
    const { patch, unknown } = cleanModelPatch(spec, {
      customQuestions: [
        {
          id: 'security.c-pentest',
          moduleId: 'security',
          label: { en: 'Pentest', fr: 'Test d’intrusion' },
          prompt: { en: 'When?', fr: 'Quand ?' },
          explain: { en: '', fr: '' },
          kind: 'text',
          required: false,
          origin: 'ai',
        },
      ],
      sections: [
        {
          id: 'security',
          answers: { 'security.c-pentest': { value: 'Yearly', state: 'answered', reason: '' } },
        },
      ],
    } as never);
    expect(unknown).toBe(0);
    expect(patch.sections?.[0].answers).toHaveProperty(['security.c-pentest']);
  });
});

describe('local answer format', () => {
  it('limits answers to the given question ids and bounds their length', () => {
    const schema = localOutputSchema(['security.2', 'security.4']);
    expect(schema.properties.answers.maxItems).toBe(5);
    expect(schema.properties.answers.items.properties.question.enum).toEqual([
      'security.2',
      'security.4',
    ]);
    expect(schema.properties.answers.items.properties.value.maxLength).toBeLessThanOrEqual(1200);
  });

  it('turns answers into patch sections and moves explanations of open questions to the reason', () => {
    const proposal = localResultToProposal({
      title: '',
      answers: [
        { question: 'security.2', value: 'STRIDE', state: 'answered' },
        { question: 'security.4', value: 'Not defined yet', state: 'unknown' },
        { question: 'quality.1', value: '99.9%', state: 'answered', reason: 'SLA' },
        { question: 'no-dot', value: 'ignored', state: 'answered' },
      ],
      assumptions: ['Assumed a web app'],
    });
    expect(proposal.title).toBe('Suggestions from a local model');
    expect(proposal.patch.sections).toEqual([
      {
        id: 'security',
        answers: {
          'security.2': { value: 'STRIDE', state: 'answered', reason: '' },
          'security.4': { value: '', state: 'unknown', reason: 'Not defined yet' },
        },
      },
      {
        id: 'quality',
        answers: { 'quality.1': { value: '99.9%', state: 'answered', reason: 'SLA' } },
      },
    ]);
    expect(proposal.assumptions).toEqual(['Assumed a web app']);
  });

  it('strips grammar-hostile keywords from the full proposal schema', () => {
    const schema = grammarSchema({
      $schema: 'x',
      type: 'object',
      properties: { maxLength: { type: 'string', maxLength: 5, pattern: '^a' } },
      propertyNames: {},
    });
    expect(schema).toEqual({ type: 'object', properties: { maxLength: { type: 'string' } } });
  });
});

describe('Ollama client against a fake server', () => {
  let server: FastifyInstance;
  const calls: any[] = [];
  let reply: (body: any) => { status: number; body: unknown } = () => ({ status: 500, body: {} });
  const saved = { url: process.env.OLLAMA_URL, ctx: process.env.OLLAMA_NUM_CTX };
  beforeAll(async () => {
    server = Fastify();
    server.get('/api/version', async () => ({ version: '0.99.0' }));
    server.get('/api/tags', async () => ({
      models: [
        { name: 'tiny:2b', size: 10, details: { family: 'tiny', parameter_size: '2B' } },
        { name: 'nomic-embed-text:latest', size: 5 },
      ],
    }));
    server.get('/api/ps', async () => ({ models: [{ name: 'tiny:2b' }] }));
    server.post('/api/show', async (req: any) =>
      req.body.model === 'tiny:2b'
        ? {
            model_info: { 'tiny.context_length': 4096 },
            capabilities: ['completion'],
            details: { parameter_size: '2B' },
          }
        : req.body.model.startsWith('nomic')
          ? { model_info: { 'bert.context_length': 2048 }, capabilities: ['embedding'] }
          : {},
    );
    server.post('/api/chat', async (req, res) => {
      calls.push(req.body);
      const r = reply(req.body);
      return res.code(r.status).send(r.body);
    });
    await server.listen({ port: 0, host: '127.0.0.1' });
    process.env.OLLAMA_URL = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}/`;
  });
  afterEach(() => {
    calls.length = 0;
    delete process.env.OLLAMA_NUM_CTX;
    clearOllamaCache();
  });
  afterAll(async () => {
    await server.close();
    process.env.OLLAMA_URL = saved.url;
    if (saved.ctx) process.env.OLLAMA_NUM_CTX = saved.ctx;
  });

  it('caps the requested window at what the model supports', async () => {
    expect(ollamaNumCtx()).toBe(8192);
    expect(await ollamaContextWindow('tiny:2b')).toBe(4096);
    process.env.OLLAMA_NUM_CTX = '2048';
    expect(await ollamaContextWindow('tiny:2b')).toBe(2048);
    expect(await ollamaContextWindow('unknown-model')).toBe(2048);
    delete process.env.OLLAMA_NUM_CTX;
    expect(await ollamaContextWindow('unknown-model')).toBe(8192);
  });

  it('sends a compact context with the bounded answer format when the specification does not fit', async () => {
    reply = () => ({
      status: 200,
      body: {
        message: {
          content: JSON.stringify({
            title: 'Security gaps',
            answers: [{ question: 'security.2', value: 'STRIDE per boundary', state: 'answered' }],
            assumptions: [],
          }),
        },
        prompt_eval_count: 1500,
        eval_count: 80,
        done_reason: 'stop',
      },
    });
    const spec = example();
    delete spec.sections.find((s) => s.id === 'security')!.answers['security.2'];
    const { result, context, usage } = await generate(
      'ollama',
      'tiny:2b',
      spec,
      'Review the “Security & privacy” section.',
      AbortSignal.timeout(10_000),
    );
    const body = calls[0];
    expect(body.options).toMatchObject({ num_ctx: 4096, temperature: 0.2 });
    expect(body.options.num_predict).toBeLessThanOrEqual(4096 / 3);
    expect(body.keep_alive).toBe('10m');
    expect(body.messages[0].content).toBe(localSystemPrompt);
    expect(body.messages[1].content.length).toBeLessThanOrEqual(
      (4096 - body.options.num_predict) * 3,
    );
    expect(body.format.properties.answers.items.properties.question.enum).toContain('security.2');
    expect(context).toMatchObject({ mode: 'compact', window: 4096, focus: ['security'] });
    expect(usage).toEqual({ inputTokens: 1500, outputTokens: 80 });
    expect(result.patch.sections).toEqual([
      {
        id: 'security',
        answers: { 'security.2': expect.objectContaining({ value: 'STRIDE per boundary' }) },
      },
    ]);
  });

  it('uses the full proposal format with a grammar-safe schema when the window is large enough', async () => {
    process.env.OLLAMA_NUM_CTX = '131072';
    reply = () => ({
      status: 200,
      body: {
        message: { content: JSON.stringify({ title: 'Nothing', patch: {}, assumptions: [] }) },
        done_reason: 'stop',
      },
    });
    const { context } = await generate(
      'ollama',
      'unknown-large',
      example(),
      'Help',
      AbortSignal.timeout(10_000),
    );
    expect(context.mode).toBe('full');
    expect(calls[0].messages[0].content).toBe(systemPrompt);
    expect(calls[0].options.num_ctx).toBe(131072);
    const format = keys(calls[0].format);
    for (const hostile of ['maxLength', 'pattern', 'propertyNames', '$schema'])
      expect(format).not.toContain(hostile);
  });

  it('reports a truncated answer and the local server’s own error message', async () => {
    reply = () => ({
      status: 200,
      body: { message: { content: '{"title":' }, done_reason: 'length' },
    });
    await expect(
      generate('ollama', 'tiny:2b', example(), 'Help', AbortSignal.timeout(10_000)),
    ).rejects.toThrow(/answer limit/);
    reply = () => ({ status: 400, body: { error: { message: 'failed to parse grammar' } } });
    await expect(
      generate('ollama', 'tiny:2b', example(), 'Help', AbortSignal.timeout(10_000)),
    ).rejects.toThrow(/400\): failed to parse grammar/);
    reply = () => ({ status: 404, body: { error: 'model "x" not found' } });
    const error = await generate(
      'ollama',
      'tiny:2b',
      example(),
      'Help',
      AbortSignal.timeout(10_000),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toContain('model "x" not found');
  });

  it('reports version, models, limits and whether the configured models are installed', async () => {
    const status = await ollamaStatus({ chatModel: 'tiny:2b', embeddingModel: 'nomic-embed-text' });
    expect(status).toMatchObject({
      reachable: true,
      version: '0.99.0',
      numCtx: 8192,
      chatModel: { installed: true },
      embeddingModel: { installed: true },
    });
    if (!status.reachable) return;
    expect(status.url).not.toMatch(/\/$/);
    expect(status.models.find((m) => m.name === 'tiny:2b')).toMatchObject({
      contextLength: 4096,
      loaded: true,
      capabilities: ['completion'],
      parameterSize: '2B',
    });
    expect((await ollamaStatus({ chatModel: 'missing:7b' })).chatModel).toEqual({
      name: 'missing:7b',
      installed: false,
    });
  });

  it('reports an unreachable server without leaking credentials from the URL', async () => {
    const url = process.env.OLLAMA_URL;
    process.env.OLLAMA_URL = 'http://user:secret@127.0.0.1:9';
    try {
      const status = await ollamaStatus();
      expect(status).toMatchObject({ reachable: false, error: 'Ollama is unreachable' });
      expect(JSON.stringify(status)).not.toContain('secret');
    } finally {
      process.env.OLLAMA_URL = url;
    }
  });
});
