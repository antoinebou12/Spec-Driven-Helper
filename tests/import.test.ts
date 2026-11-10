import { describe, it, expect } from 'vitest';
import { analyzeRepository, safeFiles } from '../packages/shared/src/import-rules';
import { documentBlocks, findingsToPatch, mapDocument } from '../packages/shared/src/import-mapping';
import { stackAnswerSuggestions, stackQuestions, preferredVersion } from '../packages/shared/src/stack';
import { completeness } from '../packages/shared/src/completeness';
import { createSpec, applySpecPatch, readiness, isBlankValue } from '../packages/shared/src/domain';
import { catalogSeed, seedSlugs } from '../apps/api/src/catalog-seed';
import { formatAnswer, parseAnswer } from '../packages/shared/src/markdown';
import { findQuestion } from '../packages/shared/src/templates';

const repo = {
  'README.md': '# Tracker\n\nA portal where customers submit and follow service requests, and agents reply from a shared queue.\n',
  'web/package.json': JSON.stringify({ dependencies: { react: '^19.1.0' }, devDependencies: { typescript: '~5.9.0', vitest: '^3.2.0', '@playwright/test': '^1.56.0' }, engines: { node: '>=24' } }),
  'api/pyproject.toml': '[project]\nrequires-python = ">=3.13"\ndependencies = ["fastapi>=0.115", "django==5.2.1", "psycopg[binary]"]\n',
  'compose.yaml': 'services:\n  db:\n    image: postgres:17\n  cache:\n    image: redis:8\n',
  'Dockerfile': 'FROM ubuntu:24.04\nRUN apt-get update\n',
  '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: pnpm lint\n      - run: pnpm test\n      - run: npx playwright test\n      - uses: gitleaks/gitleaks-action@v2\n      - uses: docker/build-push-action@v6\n',
  'openapi.yaml': 'openapi: 3.1.0\ninfo:\n  title: Tracker\n',
  '.env': 'DATABASE_PASSWORD=super-secret',
  '.env.example': 'DATABASE_URL=\nSESSION_SECRET=\n',
  'deploy/key.pem': '-----BEGIN PRIVATE KEY-----',
};

describe('repository import rules', () => {
  it('never analyses secret files but keeps example configuration', () => {
    const files = safeFiles(repo);
    expect(files).not.toHaveProperty('.env');
    expect(files).not.toHaveProperty('deploy/key.pem');
    expect(files).toHaveProperty('.env.example');
    const all = JSON.stringify(analyzeRepository(repo));
    expect(all).not.toContain('super-secret');
    expect(all).toContain('DATABASE_URL, SESSION_SECRET');
  });
  it('detects stack, versions, pipeline stages and contracts with evidence', () => {
    const findings = analyzeRepository(repo);
    const slugs = findings.filter((f) => f.stack).map((f) => `${f.stack!.slug}@${f.stack!.version ?? ''}`);
    expect(slugs).toEqual(
      expect.arrayContaining(['react@19', 'typescript@5', 'fastapi@0.115', 'django@5.2', 'python@3.13', 'postgresql@', 'redis@', 'ubuntu@24.04 LTS', 'github-actions@', 'openapi@', 'nodejs@24']),
    );
    const ci = findings.find((f) => f.rule === 'ci-pipelines')!;
    expect(ci.answers!['delivery.11']).toBe('GitHub Actions');
    expect(ci.answers!['delivery.12']).toEqual(expect.arrayContaining(['Lint and format check', 'Unit tests', 'End-to-end tests', 'Secret scan', 'Build artifact / image']));
    expect(findings.every((f) => f.evidence)).toBe(true);
  });
  it('turns findings into a reviewable patch without overwriting answers', () => {
    const spec = createSpec(crypto.randomUUID(), 'Brownfield');
    spec.sections.find((s) => s.id === 'delivery')!.answers['delivery.11'] = { value: 'Jenkins', state: 'answered', reason: '' };
    const patch = findingsToPatch(spec, catalogSeed, analyzeRepository(repo), 'en');
    const next = applySpecPatch(spec, patch, 'importer');
    const answer = (id: string) => next.sections.find((s) => s.id === id.split('.')[0])!.answers[id]?.value;
    expect(answer('delivery.11')).toBe('Jenkins');
    expect(JSON.parse(answer('data.11')!)).toEqual(['OpenAPI']);
    expect(JSON.parse(answer('technology.1')!).map((r: string[]) => r[0])).toEqual(expect.arrayContaining(['React', 'Django', 'PostgreSQL']));
    expect(next.description).toContain('customers submit and follow service requests');
    expect(next.stack.find((e) => e.technologyId === seedSlugs.get('django'))!.version).toBe('5.2');
    expect(next.technologyIds).toContain(seedSlugs.get('react'));
  });
});

describe('document import rules', () => {
  const doc = `# Product brief

## Problem to solve
Agents lose track of customer requests across email.

## Objectifs métier
Réduire les courriels de suivi de 30 %.

## Requirements
- REQ-1: Customers submit a request
- **ADR-2** — Use PostgreSQL for requests

## Budget meeting notes
Hosting under $600 per month.

## Security considerations
Tenant isolation matters most.
`;
  it('maps headings to questions in either language and keeps the rest as notes', () => {
    const spec = createSpec(crypto.randomUUID(), 'Docs');
    const mapping = mapDocument(spec, documentBlocks(doc, 'markdown'), 'brief.md');
    expect(mapping.matched.map((m) => m.target)).toEqual(expect.arrayContaining(['discovery.1', 'discovery.2']));
    const next = applySpecPatch(spec, mapping.patch, 'importer');
    expect(next.sections[0].answers['discovery.1'].value).toContain('lose track');
    expect(next.items.map((i) => `${i.id}:${i.type}:${i.status}`)).toEqual(['REQ-001:requirement:draft', 'ADR-002:decision:draft']);
    expect(next.sections.find((s) => s.id === 'security')!.markdown).toContain('Tenant isolation matters most.');
    expect(next.sections[0].markdown).toContain('<!-- sdd:answer discovery.1 -->\nAgents lose track');
  });
  it('reads HTML and plain text headings', () => {
    expect(documentBlocks('<h2>Problem to solve</h2><p>Slow <b>support</b></p><script>x()</script>', 'html')).toEqual([{ heading: 'Problem to solve', body: 'Slow support' }]);
    expect(documentBlocks('PROBLEM TO SOLVE\nSlow support\n', 'text')[0]).toEqual({ heading: 'PROBLEM TO SOLVE', body: 'Slow support' });
  });
});

describe('stack assistance and structured answers', () => {
  it('prefers LTS versions when asked', () => {
    const node = catalogSeed.find((t) => t.id === seedSlugs.get('nodejs'))!;
    expect(preferredVersion(node, true)).toBe('24');
    expect(preferredVersion(node, false)).toBe('26');
    const react = catalogSeed.find((t) => t.id === seedSlugs.get('react'))!;
    expect(preferredVersion(react, true)).toBe('19');
  });
  it('suggests answers and rule questions from the stack', () => {
    const spec = createSpec(crypto.randomUUID(), 'Stack');
    spec.stack = [
      { technologyId: seedSlugs.get('django')!, layer: 'backend', version: '5.2', note: '' },
      { technologyId: seedSlugs.get('kafka')!, layer: 'communication', version: '4.1', note: '' },
      { technologyId: seedSlugs.get('azure')!, layer: 'infrastructure', version: '', note: '' },
    ];
    const suggestions = stackAnswerSuggestions(spec, catalogSeed, 'en');
    const answers = Object.assign({}, ...(suggestions.sections ?? []).map((s) => s.answers));
    expect(JSON.parse(answers['data.10'].value)).toEqual(['Event streaming']);
    expect(JSON.parse(answers['delivery.10'].value)).toEqual(['Microsoft Azure']);
    const questions = stackQuestions(spec, catalogSeed);
    expect(questions.map((q) => q.id)).toEqual(expect.arrayContaining(['architecture.c-django-admin', 'data.c-messaging-guarantee', 'operations.c-dead-letter']));
    const next = applySpecPatch(spec, { customQuestions: questions, sections: [{ id: 'architecture', answers: { 'architecture.c-django-admin': { value: 'yes', state: 'answered', reason: '' } } }] }, 'editor');
    expect(next.sections.find((s) => s.id === 'architecture')!.markdown).toContain('<!-- sdd:answer architecture.c-django-admin -->');
    const removed = applySpecPatch(next, { removeCustomQuestions: ['architecture.c-django-admin'] }, 'editor');
    expect(removed.sections.find((s) => s.id === 'architecture')!.answers['architecture.c-django-admin']).toBeUndefined();
  });
  it('renders and parses switch and multi-select answers', () => {
    const multi = findQuestion('data.11')!;
    const value = JSON.stringify(['OpenAPI', 'JSON Schema']);
    const text = formatAnswer(multi, { value, state: 'answered', reason: '' }, 'fr');
    expect(text).toBe('- OpenAPI\n- JSON Schema');
    expect(parseAnswer(multi, text)!.value).toBe(value);
    const toggle = findQuestion('security.12')!;
    expect(formatAnswer(toggle, { value: 'yes', state: 'answered', reason: '' }, 'fr')).toBe('Oui');
    expect(parseAnswer(toggle, 'Oui')!.value).toBe('yes');
    expect(isBlankValue('[]')).toBe(true);
    expect(isBlankValue('[["",""]]')).toBe(true);
    expect(isBlankValue('["OpenAPI"]')).toBe(false);
  });
  it('measures completeness separately from readiness', () => {
    const spec = createSpec(crypto.randomUUID(), 'Progress');
    expect(completeness(spec).percent).toBe(0);
    spec.sections[0].answers['discovery.1'] = { value: 'Problem', state: 'answered', reason: '' };
    spec.sections[1].answers['data.10'] = { value: '[]', state: 'answered', reason: '' } as any;
    const c = completeness(spec);
    expect(c.requiredDone).toBe(1);
    expect(c.percent).toBeGreaterThan(0);
    expect(readiness(spec).ready).toBe(false);
  });
});
