import { buildExampleSpec } from '../packages/shared/src/example';
import { compactRunContext } from '../apps/api/src/local-context';
const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
for (const b of [6000, 8000, 12000, 30000]) { const r = compactRunContext(spec, 'Review “Security & privacy”', { 'imported/readme.md': 'x'.repeat(50000) }, b); const j = JSON.parse(r.text); console.log(b, r.text.length, j.importedMaterial?.['imported/readme.md']?.length ?? 0); }
const r0 = compactRunContext(spec, 'Review “Security & privacy”', {}, 100000); console.log('no-material max', r0.text.length);
