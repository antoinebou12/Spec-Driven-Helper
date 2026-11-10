/**
 * Checks a real Ollama server the way SDD Studio uses it: connection, model limits, one proposal
 * generated from the example specification, and embeddings. Nothing is written to the database.
 *
 *   pnpm ollama:check [--model gemma2:2b] [--embedding nomic-embed-text] [--prompt "..."]
 */
import { parseArgs } from 'node:util';
import { buildExampleSpec } from '../packages/shared/src/example';
import { applySpecPatch } from '../packages/shared/src/domain';
import { generate } from '../apps/api/src/providers';
import { ollamaContextWindow, ollamaStatus, ollamaUrl } from '../apps/api/src/ollama';

const { values } = parseArgs({
  options: {
    model: { type: 'string' },
    embedding: { type: 'string', default: 'nomic-embed-text' },
    prompt: {
      type: 'string',
      default:
        'Suggest answers for the open questions in the “Security & privacy” section, based on what is already recorded.',
    },
    'skip-generate': { type: 'boolean', default: false },
  },
});

const ok = (message: string) => console.log(`ok    ${message}`);
const fail = (message: string): never => {
  console.error(`FAIL  ${message}`);
  process.exit(1);
};

const status = await ollamaStatus({ embeddingModel: values.embedding });
if (!status.reachable) fail(`${status.error} at ${status.url} (set OLLAMA_URL)`);
if (!status.reachable) process.exit(1);
ok(`Ollama ${status.version} at ${status.url}; requested context window ${status.numCtx} tokens`);
for (const m of status.models)
  console.log(
    `      ${m.name.padEnd(28)} ${(m.parameterSize ?? '').padEnd(6)} context ${m.contextLength ?? '?'}  ${m.capabilities.join(', ')}${m.loaded ? '  (loaded)' : ''}`,
  );

const chat = status.models.filter(
  (m) => m.capabilities.includes('completion') && !m.capabilities.includes('embedding'),
);
const model = values.model ?? chat[0]?.name;
if (!model) fail('No chat model installed. Pull one, for example: ollama pull qwen2.5:7b');
if (!status.models.some((m) => m.name === model)) fail(`Model ${model} is not installed`);

if (!values['skip-generate']) {
  const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
  // Leave half of the security answers open, as in a specification still being written.
  const security = spec.sections.find((s) => s.id === 'security')!;
  for (const id of Object.keys(security.answers).filter((_, i) => i % 2))
    delete security.answers[id];
  const window = await ollamaContextWindow(model!);
  console.log(`      generating with ${model} (window ${window} tokens)…`);
  const started = Date.now();
  const { result, usage, context } = await generate(
    'ollama',
    model!,
    spec,
    values.prompt!,
    AbortSignal.timeout(600_000),
  );
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  ok(
    `proposal “${result.title}” in ${seconds}s; tokens ${usage.inputTokens} in, ${usage.outputTokens} out; context ${context.mode}${context.focus ? ` (focus ${context.focus.join(', ')})` : ''}, ${context.characters} characters`,
  );
  if (usage.inputTokens >= window)
    fail(
      `the prompt filled the whole window (${usage.inputTokens} ≥ ${window}); input was truncated`,
    );
  const sections = result.patch.sections ?? [];
  const answers = sections.reduce((n, s) => n + Object.keys(s.answers ?? {}).length, 0);
  console.log(
    `      ${sections.length} sections, ${answers} answers, ${result.patch.items?.length ?? 0} items, ${result.assumptions.length} assumptions${context.echoesDropped ? `; ${context.echoesDropped} echoed answers dropped` : ''}${context.unknownDropped ? `; ${context.unknownDropped} answers to unknown questions dropped` : ''}`,
  );
  if (!answers && !result.patch.items?.length) fail('the proposal contains no usable change');
  for (const section of sections)
    for (const [id, answer] of Object.entries(section.answers ?? {}))
      console.log(
        `      ${id} [${answer.state}] ${answer.value.replace(/\s+/g, ' ').slice(0, 110)}`,
      );
  try {
    applySpecPatch(spec, result.patch, 'ollama-check');
    ok('the proposal applies to the specification');
  } catch (error) {
    fail(`the proposal does not apply: ${(error as Error).message}`);
  }
}

const embedding = status.models.find(
  (m) => m.name === values.embedding || m.name === `${values.embedding}:latest`,
);
if (!embedding)
  console.log(
    `skip  embeddings: ${values.embedding} is not installed (ollama pull ${values.embedding})`,
  );
else {
  const response = await fetch(`${ollamaUrl()}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: embedding.name,
      input: 'Passwords are hashed with bcrypt and sessions expire after 12 hours.',
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) fail(`embedding request failed (${response.status})`);
  const vector = ((await response.json()) as { embeddings?: number[][] }).embeddings?.[0] ?? [];
  if (!vector.length || vector.some((v) => !Number.isFinite(v)))
    fail('embedding response is empty or invalid');
  ok(`embeddings from ${embedding.name}: ${vector.length} dimensions`);
}
