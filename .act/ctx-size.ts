import { buildExampleSpec } from '../packages/shared/src/example';
import { runContext, systemPrompt } from '../apps/api/src/providers';
const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
const ctx = runContext(spec, 'Improve the security section');
console.log('context chars', ctx.length, 'approx tokens', Math.round(ctx.length / 3.5), 'system', systemPrompt.length);

