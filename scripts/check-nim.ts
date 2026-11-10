/**
 * Checks an NVIDIA NIM endpoint the way SDD Studio uses it: the model list, one streamed reply with
 * token usage, and one tool call. Nothing is written to the database and the key is never printed.
 *
 *   NVIDIA_API_KEY=nvapi-… pnpm nim:check [--model openai/gpt-oss-20b] [--skip-tools]
 *   NIM_BASE_URL=http://localhost:8000/v1 pnpm nim:check        (self-hosted; no key needed)
 *
 * The free hosted endpoint needs a key from https://build.nvidia.com (sign in, open a model, "Get API key").
 */
import { parseArgs } from 'node:util';
import { isNimChatModel, nimHostedUrl, nimUrl } from '../apps/api/src/nim';

const { values } = parseArgs({
  options: {
    model: { type: 'string' },
    'skip-tools': { type: 'boolean', default: false },
  },
});

const ok = (message: string) => console.log(`ok    ${message}`);
const fail = (message: string): never => {
  console.error(`FAIL  ${message}`);
  process.exit(1);
};

let url: string;
try {
  url = nimUrl();
} catch (error) {
  fail((error as Error).message);
  throw error;
}
const key = process.env.NVIDIA_API_KEY?.trim();
if (url === nimHostedUrl && !key)
  fail(
    'The hosted endpoint needs a key: get one free at https://build.nvidia.com and set NVIDIA_API_KEY',
  );
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(key ? { Authorization: `Bearer ${key}` } : {}),
};
const where =
  url === nimHostedUrl
    ? 'the hosted NVIDIA endpoint'
    : `a self-hosted NIM at ${new URL(url).origin}`;

/** Never shows the provider's error text: cloud error bodies can echo credential fragments. */
async function post(body: object, timeout = 120_000) {
  const response = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok || !response.body) return { status: response.status, chunks: [] as any[] };
  const chunks: any[] = [];
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const part of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.startsWith('data:') && line.slice(5).trim() !== '[DONE]')
        chunks.push(JSON.parse(line.slice(5)));
    }
  }
  return { status: response.status, chunks };
}

const listed = await fetch(`${url}/models`, { headers, signal: AbortSignal.timeout(15_000) });
if (listed.status === 401 || listed.status === 403)
  fail(`${where} refused the key (${listed.status}); check NVIDIA_API_KEY`);
if (!listed.ok) fail(`could not list models at ${where} (${listed.status})`);
const ids = (((await listed.json()) as { data?: { id: string }[] }).data ?? [])
  .map((m) => m.id)
  .sort();
const chat = ids.filter(isNimChatModel);
ok(`${where}: ${ids.length} models, ${chat.length} that can chat`);
console.log(`      ${chat.slice(0, 8).join(', ')}${chat.length > 8 ? ', …' : ''}`);

const model =
  values.model ?? (chat.includes('openai/gpt-oss-20b') ? 'openai/gpt-oss-20b' : chat[0]);
if (!model) fail('No chat model is listed');
if (!ids.includes(model!)) fail(`Model ${model} is not listed`);

console.log(`      streaming a reply from ${model}…`);
const started = Date.now();
const reply = await post({
  model,
  stream: true,
  stream_options: { include_usage: true },
  max_tokens: 200,
  temperature: 0.4,
  messages: [
    { role: 'user', content: 'In one short sentence, why write a software design document?' },
  ],
});
if (reply.status === 401 || reply.status === 403) fail(`the key was refused (${reply.status})`);
if (reply.status === 429)
  fail(
    'rate limited (429); the free tier allows a limited number of requests per minute, try again shortly',
  );
if (reply.status !== 200) fail(`the reply request failed (${reply.status})`);
const text = reply.chunks.map((c) => c.choices?.[0]?.delta?.content ?? '').join('');
const usage = reply.chunks.find((c) => c.usage)?.usage;
if (!text.trim()) fail('the stream carried no text');
ok(
  `streamed ${reply.chunks.length} chunks in ${((Date.now() - started) / 1000).toFixed(1)}s: “${text.replace(/\s+/g, ' ').trim().slice(0, 100)}”`,
);
if (usage) ok(`token usage reported: ${usage.prompt_tokens} in, ${usage.completion_tokens} out`);
else
  console.log(
    'warn  no token usage in the stream; the project token budget will count 0 for this model',
  );

if (!values['skip-tools']) {
  const tool = {
    type: 'function',
    function: {
      name: 'record_answer',
      description: 'Record the person’s answer to a design question.',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      },
    },
  };
  const called = await post({
    model,
    stream: true,
    max_tokens: 300,
    temperature: 0.2,
    tools: [tool],
    messages: [
      {
        role: 'user',
        content:
          'Record this: the database for the project is PostgreSQL. Use the record_answer tool.',
      },
    ],
  });
  if (called.status === 400)
    console.log(
      `skip  ${model} does not accept tools: the Build with AI conversation needs a model that does, for example openai/gpt-oss-20b or mistralai/mistral-large-2-instruct`,
    );
  else if (called.status !== 200) fail(`the tool request failed (${called.status})`);
  else {
    const calls = new Map<number, { name: string; args: string }>();
    for (const chunk of called.chunks)
      for (const d of chunk.choices?.[0]?.delta?.tool_calls ?? []) {
        const call = calls.get(d.index ?? 0) ?? { name: '', args: '' };
        call.name += d.function?.name ?? '';
        call.args += d.function?.arguments ?? '';
        calls.set(d.index ?? 0, call);
      }
    const first = [...calls.values()][0];
    if (!first)
      console.log(
        `warn  ${model} answered without calling the tool; it may not follow tool instructions reliably`,
      );
    else {
      try {
        JSON.parse(first.args || '{}');
      } catch {
        fail(`the tool call arrived with arguments that are not JSON: ${first.args.slice(0, 80)}`);
      }
      ok(`tool call ${first.name}(${first.args.replace(/\s+/g, ' ').slice(0, 80)})`);
    }
  }
}
