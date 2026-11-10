import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { setupApp, type Harness } from './helpers';
import { nimHostedUrl, nimUrl, isNimChatModel } from '../apps/api/src/nim';
import {
  checkCapabilities,
  generate,
  listModels,
  openaiHost,
  ProviderError,
} from '../apps/api/src/providers';
import { chatTurn } from '../apps/api/src/chat-providers';
import { createSpec } from '../packages/shared/src/domain';

/**
 * NVIDIA NIM against a fake OpenAI-compatible server: the free hosted endpoint and a self-hosted NIM
 * share one protocol, so proposals, model lists and the streaming conversation all go through it.
 */
const key = 'nvapi-test-key-not-real-1234567890';
const catalog = [
  'nvidia/embed-qa-4',
  'openai/gpt-oss-20b',
  'meta/llama-guard-4-12b',
  'mistralai/mistral-large-2-instruct',
  'nvidia/nemotron-4-340b-reward',
  'google/gemma-3-12b-it',
  'nvidia/riva-translate-4b-instruct',
];
type Seen = { path: string; authorization?: string; body: any };
type Scripted = { status?: number; json?: unknown; sse?: object[] };

let h: Harness;
let nim: FastifyInstance;
const seen: Seen[] = [];
let scripted: Scripted[] = [];
const hosted = process.env.NIM_BASE_URL;
let selfHosted = '';

beforeAll(async () => {
  nim = Fastify();
  nim.get('/v1/models', async (req) => {
    seen.push({ path: '/models', authorization: req.headers.authorization, body: undefined });
    return { object: 'list', data: catalog.map((id) => ({ id, object: 'model' })) };
  });
  nim.post('/v1/chat/completions', async (req, reply) => {
    seen.push({
      path: '/chat/completions',
      authorization: req.headers.authorization,
      body: req.body,
    });
    const next = scripted.shift() ?? {
      json: { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
    };
    // Error bodies from a cloud API can echo credential fragments; the app must not repeat them.
    if (next.status)
      return reply.code(next.status).send({ error: { message: `bad token ${key}` } });
    if (next.sse) {
      reply.header('Content-Type', 'text/event-stream');
      return `${next.sse.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
    }
    return next.json;
  });
  await nim.listen({ host: '127.0.0.1', port: 0 });
  selfHosted = `http://127.0.0.1:${(nim.server.address() as AddressInfo).port}/v1/`;
  process.env.NIM_BASE_URL = selfHosted;
  h = await setupApp('nim');
});
afterAll(async () => {
  if (hosted === undefined) delete process.env.NIM_BASE_URL;
  else process.env.NIM_BASE_URL = hosted;
  await h?.teardown();
  await nim?.close();
});

const useHosted = () => delete process.env.NIM_BASE_URL;
const useSelfHosted = () => {
  process.env.NIM_BASE_URL = selfHosted;
};
const setKey = (secret = key) =>
  h.request('PUT', '/integrations/nvidia-nim', { model: 'openai/gpt-oss-20b', secret });
const clearKey = () => h.db.collection('integrations').deleteOne({ id: 'nvidia-nim' });
const spec = createSpec(
  '00000000-0000-4000-8000-0000000000aa',
  'Reference',
  'en',
  false,
  'Web application',
);
const signal = () => AbortSignal.timeout(5_000);
const last = () => seen.at(-1)!;
const proposal = {
  title: 'Clarify the problem',
  patch: {
    sections: [
      {
        id: 'discovery',
        answers: {
          'discovery.1': {
            value: 'Customers lose track of requests.',
            state: 'answered',
            reason: '',
          },
        },
      },
    ],
  },
  assumptions: [],
  sources: [],
};
const answer = (content: string, extra: object = {}) => ({
  json: {
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 11, completion_tokens: 7 },
    ...extra,
  },
});

describe('NIM address', () => {
  it('defaults to the free hosted catalog and trims a trailing slash from a self-hosted address', () => {
    useHosted();
    expect(nimUrl()).toBe(nimHostedUrl);
    expect(nimHostedUrl).toBe('https://integrate.api.nvidia.com/v1');
    process.env.NIM_BASE_URL = ' http://nim:8000/v1// ';
    expect(nimUrl()).toBe('http://nim:8000/v1');
    useSelfHosted();
  });

  it('refuses addresses that are not plain http(s) URLs or that carry credentials', () => {
    for (const bad of [
      'nim:8000',
      'ftp://nim/v1',
      'file:///etc/passwd',
      'http://user:secret@nim:8000/v1',
    ]) {
      process.env.NIM_BASE_URL = bad;
      expect(() => nimUrl(), bad).toThrow(/NIM_BASE_URL/);
    }
    useSelfHosted();
  });

  it('lists chat models only', () => {
    expect(catalog.filter(isNimChatModel)).toEqual([
      'openai/gpt-oss-20b',
      'mistralai/mistral-large-2-instruct',
      'google/gemma-3-12b-it',
    ]);
  });
});

describe('NVIDIA NIM settings', () => {
  it('needs a key for the hosted endpoint, stores it encrypted and never returns it', async () => {
    useHosted();
    try {
      await clearKey();
      const before = (await h.request('GET', '/integrations'))
        .json()
        .find((i: any) => i.id === 'nvidia-nim');
      expect(before).toMatchObject({
        label: 'NVIDIA NIM',
        configured: false,
        local: false,
        endpoint: 'hosted',
      });
      await expect(openaiHost('nvidia-nim')).rejects.toThrow(
        /NVIDIA NIM API key.*build\.nvidia\.com/,
      );

      expect((await setKey()).statusCode).toBe(200);
      const stored = await h.db.collection('integrations').findOne({ id: 'nvidia-nim' });
      expect(stored!.secret).not.toContain('nvapi-');
      const list = await h.request('GET', '/integrations');
      expect(list.body).not.toContain('nvapi-');
      expect(list.json().find((i: any) => i.id === 'nvidia-nim')).toMatchObject({
        configured: true,
        model: 'openai/gpt-oss-20b',
      });
      expect(JSON.stringify(await h.db.collection('audit').find().toArray())).not.toContain(
        'nvapi-',
      );
      expect(await openaiHost('nvidia-nim')).toMatchObject({
        label: 'NVIDIA NIM',
        url: nimHostedUrl,
        headers: { Authorization: `Bearer ${key}` },
      });
    } finally {
      useSelfHosted();
    }
  });

  it('counts a self-hosted NIM as configured without a key and does not reveal its address', async () => {
    await clearKey();
    const list = await h.request('GET', '/integrations');
    expect(list.json().find((i: any) => i.id === 'nvidia-nim')).toMatchObject({
      configured: true,
      endpoint: 'self-hosted',
    });
    expect(list.body).not.toContain('127.0.0.1');
    expect(await openaiHost('nvidia-nim')).toMatchObject({ headers: {} });
  });

  it('only lets administrators change it', async () => {
    const editor = await h.userWith('Editor');
    expect(
      (
        await h.request(
          'PUT',
          '/integrations/nvidia-nim',
          { model: 'x', secret: key },
          editor.cookie,
        )
      ).statusCode,
    ).toBe(403);
  });

  it('explains an unusable address instead of failing', async () => {
    process.env.NIM_BASE_URL = 'ftp://nim/v1';
    try {
      const list = await h.request('GET', '/integrations');
      expect(list.statusCode).toBe(200);
      expect(list.json().find((i: any) => i.id === 'nvidia-nim')).toMatchObject({
        configured: false,
      });
      await expect(openaiHost('nvidia-nim')).rejects.toThrow(/NIM_BASE_URL/);
    } finally {
      useSelfHosted();
    }
  });
});

describe('NVIDIA NIM requests', () => {
  it('lists the chat models the key can use, signed with the key', async () => {
    await setKey();
    expect(await listModels('nvidia-nim')).toEqual([
      'google/gemma-3-12b-it',
      'mistralai/mistral-large-2-instruct',
      'openai/gpt-oss-20b',
    ]);
    expect(seen.find((s) => s.path === '/models')).toMatchObject({
      authorization: `Bearer ${key}`,
    });
    const res = await h.request('GET', '/integrations/nvidia-nim/models');
    expect(res.json().models).toContain('openai/gpt-oss-20b');
  });

  it('writes a proposal without a JSON response mode, which not every NIM model accepts', async () => {
    await setKey();
    scripted = [answer(JSON.stringify(proposal))];
    const out = await generate(
      'nvidia-nim',
      'openai/gpt-oss-20b',
      spec,
      'Clarify the problem',
      signal(),
    );
    expect(out.result.title).toBe('Clarify the problem');
    expect(out.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
    expect(last()).toMatchObject({ path: '/chat/completions', authorization: `Bearer ${key}` });
    expect(last().body).toMatchObject({
      model: 'openai/gpt-oss-20b',
      max_tokens: 8192,
      temperature: 0.2,
    });
    expect(last().body.response_format).toBeUndefined();
    expect(last().body.max_completion_tokens).toBeUndefined();
    expect(last().body.messages.map((m: any) => m.role)).toEqual(['system', 'user']);
  });

  it('sends no credentials to a self-hosted NIM that has no key', async () => {
    await clearKey();
    scripted = [answer(JSON.stringify(proposal))];
    await generate('nvidia-nim', 'm', spec, 'Help', signal());
    expect(last().authorization).toBeUndefined();
  });

  it('accepts a proposal the model wrapped in a code fence', async () => {
    scripted = [answer(`Here you go:\n\`\`\`json\n${JSON.stringify(proposal)}\n\`\`\``)];
    expect((await generate('nvidia-nim', 'm', spec, 'Help', signal())).result.title).toBe(
      'Clarify the problem',
    );
  });

  it('says so when the answer was cut off', async () => {
    scripted = [
      { json: { choices: [{ message: { content: '{"title":' }, finish_reason: 'length' }] } },
    ];
    await expect(generate('nvidia-nim', 'm', spec, 'Help', signal())).rejects.toThrow(
      /NVIDIA NIM reached its answer limit/,
    );
  });

  it('treats rate limits as retryable and never repeats the provider’s error body', async () => {
    scripted = [{ status: 429 }];
    const error = await generate('nvidia-nim', 'm', spec, 'Help', signal()).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.retryable).toBe(true);
    expect(error.message).toContain('NVIDIA NIM request failed (429)');
    expect(error.message).not.toContain('nvapi-');
  });

  it('streams a reply with a tool call and its token usage', async () => {
    await setKey();
    scripted = [
      {
        sse: [
          { choices: [{ delta: { content: 'Recording ' } }] },
          { choices: [{ delta: { content: 'that.' } }] },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_1',
                      function: { name: 'propose_changes', arguments: '{"title":' },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: { tool_calls: [{ index: 0, function: { arguments: '"Facts"}' } }] },
                finish_reason: 'tool_calls',
              },
            ],
          },
          { choices: [], usage: { prompt_tokens: 40, completion_tokens: 9 } },
        ],
      },
    ];
    const deltas: string[] = [];
    const turn = await chatTurn(
      'nvidia-nim',
      'openai/gpt-oss-20b',
      [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hi' },
      ],
      [{ name: 'propose_changes', description: 'Propose', parameters: { type: 'object' } }],
      (d) => deltas.push(d),
      signal(),
    );
    expect(deltas).toEqual(['Recording ', 'that.']);
    expect(turn.text).toBe('Recording that.');
    expect(turn.toolCalls).toEqual([
      { id: 'call_1', name: 'propose_changes', arguments: '{"title":"Facts"}' },
    ]);
    expect(turn.usage).toEqual({ inputTokens: 40, outputTokens: 9 });
    expect(last().authorization).toBe(`Bearer ${key}`);
    expect(last().body).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 4000,
    });
    expect(last().body.max_completion_tokens).toBeUndefined();
    expect(last().body.tools[0]).toMatchObject({
      type: 'function',
      function: { name: 'propose_changes' },
    });
  });

  it('suggests another model when one cannot call tools', async () => {
    scripted = [{ status: 400 }];
    const tools = [
      { name: 'propose_changes', description: 'Propose', parameters: { type: 'object' } },
    ];
    const error = await chatTurn(
      'nvidia-nim',
      'm',
      [{ role: 'user', content: 'Hi' }],
      tools,
      () => {},
      signal(),
    ).catch((e) => e);
    expect(error.message).toMatch(/\(400\).*may not support tool calls.*gpt-oss-20b/);
    expect(error.message).not.toContain('nvapi-');
    scripted = [{ status: 400 }];
    const plain = await chatTurn(
      'nvidia-nim',
      'm',
      [{ role: 'user', content: 'Hi' }],
      [],
      () => {},
      signal(),
    ).catch((e) => e);
    expect(plain.message).not.toContain('tool calls');
  });
});

describe('NVIDIA NIM in the product', () => {
  const run = (projectId: string, forwarded: Record<string, unknown> = {}) =>
    h.request('POST', `/projects/${projectId}/agent`, {
      threadId: 't1',
      runId: crypto.randomUUID(),
      messages: [
        { id: crypto.randomUUID(), role: 'user', content: 'Our agents lose requests in email.' },
      ],
      tools: [],
      context: [],
      forwardedProps: { provider: 'nvidia-nim', model: 'openai/gpt-oss-20b', ...forwarded },
    });
  const events = (body: string) =>
    body
      .split('\n\n')
      .filter((b) => b.startsWith('data: '))
      .map((b) => JSON.parse(b.slice(6)));

  it('turns a queued run into a pending proposal that changes nothing until accepted', async () => {
    await setKey();
    const p = await h.createProject({ name: 'NIM run' });
    scripted = [answer(JSON.stringify(proposal))];
    const queued = await h.request('POST', `/projects/${p.id}/jobs`, {
      provider: 'nvidia-nim',
      model: 'openai/gpt-oss-20b',
      prompt: 'Clarify the problem',
    });
    expect(queued.statusCode, queued.body).toBe(200);
    const jobs = await import('../apps/api/src/jobs');
    expect(await jobs.runOnce()).toBe(true);
    expect(await h.db.collection('jobs').findOne({ id: queued.json().id })).toMatchObject({
      status: 'completed',
      provider: 'nvidia-nim',
      usage: { inputTokens: 11, outputTokens: 7 },
    });
    expect(await h.db.collection('proposals').findOne({ projectId: p.id })).toMatchObject({
      status: 'pending',
      origin: 'ai',
    });
    expect((await h.project(p.id)).spec.revision).toBe(0);
  });

  it('streams the conversation and records its tokens against the project', async () => {
    await setKey();
    const p = await h.createProject({ name: 'NIM chat' });
    scripted = [
      {
        sse: [
          { choices: [{ delta: { content: 'Tell me more.' } }] },
          { choices: [], usage: { prompt_tokens: 50, completion_tokens: 5 } },
        ],
      },
    ];
    const res = await run(p.id);
    expect(res.statusCode).toBe(200);
    const list = events(res.body);
    expect(list.find((e) => e.name === 'sdd-model')?.value).toEqual({
      provider: 'nvidia-nim',
      model: 'openai/gpt-oss-20b',
      local: false,
      toolMode: 'tools',
    });
    expect(
      list
        .filter((e) => e.type === 'TEXT_MESSAGE_CONTENT')
        .map((e) => e.delta)
        .join(''),
    ).toBe('Tell me more.');
    expect(list.at(-1).type).toBe('RUN_FINISHED');
    expect(await h.db.collection('jobs').findOne({ projectId: p.id, kind: 'chat' })).toMatchObject({
      provider: 'nvidia-nim',
      usage: { inputTokens: 50, outputTokens: 5 },
    });
  });

  it('refuses a model the catalog does not offer before any request is made', async () => {
    const p = await h.createProject({ name: 'NIM unknown model' });
    await expect(checkCapabilities('nvidia-nim', 'nobody/not-a-model', spec)).rejects.toThrow(
      /not available from NVIDIA NIM/,
    );
    const before = seen.filter((s) => s.path === '/chat/completions').length;
    expect((await run(p.id, { model: 'nobody/not-a-model' })).statusCode).toBe(503);
    expect(seen.filter((s) => s.path === '/chat/completions').length).toBe(before);
  });

  it('is never used by local-only projects, even when self-hosted', async () => {
    await setKey();
    const p = await h.createProject({ name: 'Local only', localOnly: true });
    const before = seen.length;
    expect((await run(p.id)).statusCode).toBe(403);
    expect(
      (
        await h.request('POST', `/projects/${p.id}/jobs`, {
          provider: 'nvidia-nim',
          model: 'openai/gpt-oss-20b',
          prompt: 'x',
        })
      ).statusCode,
    ).toBe(403);
    await expect(
      generate('nvidia-nim', 'm', { ...spec, localOnly: true }, 'x', signal()),
    ).rejects.toThrow(/local Ollama only/);
    expect(seen.length).toBe(before);
  });
});
