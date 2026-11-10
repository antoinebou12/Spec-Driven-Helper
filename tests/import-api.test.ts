import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { setupApp, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => {
  h = await setupApp('import');
});
afterAll(async () => h?.teardown());

describe('brownfield import API', () => {
  it('lists the import rules', async () => {
    const rules = (await h.request('GET', '/import/rules')).json();
    expect(rules.map((r: { id: string }) => r.id)).toContain('ci-pipelines');
  });
  it('imports a zipped repository as a proposal with evidence', async () => {
    const p = await h.createProject({ name: 'Brownfield' });
    const zip = new JSZip();
    zip.file('app/package.json', JSON.stringify({ dependencies: { react: '^19.0.0', fastify: '^5.0.0' } }));
    zip.file('app/.github/workflows/ci.yml', 'steps:\n  - run: npm test\n');
    zip.file('app/.env', 'TOKEN=should-never-be-read');
    const data = (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
    const res = await h.request('POST', `/projects/${p.id}/import/repository`, { source: 'zip', name: 'app.zip', data, method: 'rules' });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.body ?? '').not.toContain('should-never-be-read');
    expect(JSON.stringify(body)).not.toContain('should-never-be-read');
    const proposal = (await h.request('GET', `/projects/${p.id}/proposals`)).json()[0];
    expect(proposal.id).toBe(body.proposalId);
    expect(proposal.origin).toBe('import');
    expect(proposal.changes.map((c: { path: string }) => c.path)).toEqual(expect.arrayContaining(['stack', 'sections.delivery.answers.delivery.11']));
    expect((await h.project(p.id)).spec.stack).toEqual([]);
    const accepted = await h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/accept`);
    expect(accepted.json().stack.length).toBeGreaterThanOrEqual(3);
  });
  it('imports infrastructure code and the project license as a proposal, never reading state files', async () => {
    const p = await h.createProject({ name: 'Platform' });
    const zip = new JSZip();
    zip.file('infra/main.tf', 'terraform {\n  backend "s3" {}\n}\nprovider "aws" {}\n');
    zip.file('infra/terraform.tfstate', '{"secret_access_key":"state-secret-value"}');
    zip.file('infra/prod.tfvars', 'db_password = "tfvars-secret-value"');
    zip.file('infra/.terraform/modules/net/main.tf', 'provider "google" {}');
    zip.file('policy/deny.rego', 'package main');
    zip.file('LICENSE', 'Permission is hereby granted, free of charge, to any person obtaining a copy');
    const data = (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
    const res = await h.request('POST', `/projects/${p.id}/import/repository`, { source: 'zip', name: 'platform.zip', data, method: 'rules' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().files).toBe(3);
    const slugs = res.json().findings.flatMap((f: { stack?: { slug: string } }) => (f.stack ? [f.stack.slug] : []));
    expect(slugs).toEqual(expect.arrayContaining(['terraform', 'aws', 'opa']));
    expect(slugs).not.toContain('gcp');
    const proposal = (await h.request('GET', `/projects/${p.id}/proposals`)).json()[0];
    const raw = JSON.stringify(proposal);
    expect(raw).not.toContain('state-secret-value');
    expect(raw).not.toContain('tfvars-secret-value');
    expect(proposal.changes.map((c: { path: string }) => c.path)).toEqual(
      expect.arrayContaining(['sections.delivery.answers.delivery.15', 'sections.delivery.answers.delivery.16', 'sections.governance.answers.governance.8']),
    );
    expect((await h.project(p.id)).spec.sections.find((s: { id: string }) => s.id === 'governance').answers['governance.8']).toBeUndefined();
    const accepted = (await h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/accept`)).json();
    expect(accepted.stack.some((e: { layer: string }) => e.layer === 'iac')).toBe(true);
    expect(accepted.sections.find((s: { id: string }) => s.id === 'governance').answers['governance.8'].value).toBe('MIT');
  });

  it('shows the model infrastructure code and licenses, but never secrets', async () => {
    const { aiExcerpt } = await import('../apps/api/src/importer');
    const excerpt = aiExcerpt(
      { 'infra/main.tf': 'x', 'Chart.yaml': 'x', 'LICENSE': 'x', 'src/app.ts': 'x', '.env': 'TOKEN=x', 'infra/prod.tfvars': 'x' },
      'imported/',
    );
    expect(Object.keys(excerpt).sort()).toEqual(['imported/Chart.yaml', 'imported/LICENSE', 'imported/infra/main.tf']);
  });

  it('imports a document as a proposal and rejects unsafe Git URLs', async () => {
    const p = await h.createProject({ name: 'Docs' });
    const res = await h.request('POST', `/projects/${p.id}/import/document`, {
      name: 'brief.md',
      format: 'markdown',
      content: '## Problem to solve\nRequests get lost.\n\n## Requirements\n- REQ-7: Track requests\n',
      method: 'rules',
    });
    expect(res.json().matched).toEqual([{ heading: 'Problem to solve', target: 'discovery.1' }]);
    const bad = await h.request('POST', `/projects/${p.id}/import/repository`, { source: 'git', url: 'file:///etc', method: 'rules' });
    expect(bad.statusCode).toBe(400);
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    const denied = await h.request('POST', `/projects/${p.id}/import/document`, { name: 'x.md', format: 'markdown', content: '# x', method: 'rules' }, viewer.cookie);
    expect(denied.statusCode).toBe(403);
  });
});
