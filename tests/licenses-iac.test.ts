import { describe, it, expect } from 'vitest';
import {
  licenseFamily,
  licenseFindings,
  licenseFromText,
  licensePolicy,
  projectLicenseOption,
  type LicenseFamily,
} from '../packages/shared/src/licenses';
import { analyzeRepository } from '../packages/shared/src/import-rules';
import { findingsToPatch } from '../packages/shared/src/import-mapping';
import { stackAnswerSuggestions } from '../packages/shared/src/stack';
import { applySpecPatch, createSpec } from '../packages/shared/src/domain';
import { findQuestion } from '../packages/shared/src/templates';
import { catalogSeed, seedSlugs } from '../apps/api/src/catalog-seed';
import type { Spec } from '../packages/shared/src/schema';

const tech = (name: string, license: string, category = 'framework') =>
  ({ id: name, name, license, category }) as Parameters<typeof licenseFindings>[0][number];
const governed = (answers: Record<string, string>): Spec => {
  const spec = createSpec(crypto.randomUUID(), 'Licensed');
  const section = spec.sections.find((s) => s.id === 'governance')!;
  for (const [id, value] of Object.entries(answers))
    section.answers[id] = { value, state: 'answered', reason: '' };
  return spec;
};

describe('license families', () => {
  it('classifies SPDX identifiers and expressions', () => {
    expect(licenseFamily('MIT')).toBe('permissive');
    expect(licenseFamily('Apache-2.0')).toBe('permissive');
    expect(licenseFamily('LGPL-3.0-only')).toBe('weak-copyleft');
    expect(licenseFamily('GPL-2.0-with-classpath-exception')).toBe('weak-copyleft');
    expect(licenseFamily('GPL-3.0')).toBe('strong-copyleft');
    expect(licenseFamily('AGPL-3.0')).toBe('network-copyleft');
    expect(licenseFamily('SSPL-1.0')).toBe('source-available');
    expect(licenseFamily('BUSL-1.1')).toBe('source-available');
    expect(licenseFamily('Commercial')).toBe('commercial');
    expect(licenseFamily('')).toBe('unknown');
    expect(licenseFamily('MIT OR GPL-3.0')).toBe('permissive');
    expect(licenseFamily('AGPL-3.0 / Commercial')).toBe('commercial');
    expect(licenseFamily('MIT AND GPL-3.0')).toBe('strong-copyleft');
    expect(licenseFamily('(MIT OR GPL-3.0-or-later)')).toBe('permissive');
    expect(licenseFamily('(MIT AND Zlib)')).toBe('permissive');
    expect(licenseFamily('(MPL-2.0 OR Apache-2.0)')).toBe('permissive');
    expect(licenseFamily('Various (GPL)')).toBe('strong-copyleft');
    expect(licenseFamily('OFL-1.1')).toBe('weak-copyleft');
    expect(licenseFamily('Apache-2.0 WITH LLVM-exception')).toBe('permissive');
    expect(licenseFamily('GPL-2.0-with-classpath-exception')).toBe('weak-copyleft');
    expect(licenseFamily('CC-BY-4.0')).toBe('permissive');
    expect(licenseFamily('CC-BY-SA-4.0')).toBe('weak-copyleft');
    expect(licenseFamily('CC-BY-NC-4.0')).toBe('source-available');
  });

  it('every seeded technology has a classifiable license', () => {
    const unknown = catalogSeed
      .filter((t) => licenseFamily(t.license) === 'unknown')
      .map((t) => `${t.name}: ${t.license}`);
    expect(unknown).toEqual([]);
  });
});

describe('license expressions', () => {
  const sample: Record<Exclude<LicenseFamily, 'unknown'>, string> = {
    standard: 'W3C',
    permissive: 'MIT',
    'weak-copyleft': 'MPL-2.0',
    commercial: 'Commercial',
    'strong-copyleft': 'GPL-3.0',
    'network-copyleft': 'AGPL-3.0',
    'source-available': 'BUSL-1.1',
  };
  const order = Object.keys(sample) as (keyof typeof sample)[];

  it('resolves OR to the most permissive choice and AND to the most restrictive, in any order', () => {
    for (const a of order)
      for (const b of order) {
        const [best, worst] = order.indexOf(a) <= order.indexOf(b) ? [a, b] : [b, a];
        expect(licenseFamily(`${sample[a]} OR ${sample[b]}`), `${a} OR ${b}`).toBe(best);
        expect(licenseFamily(`(${sample[a]} OR ${sample[b]})`), `(${a} OR ${b})`).toBe(best);
        expect(licenseFamily(`${sample[a]} AND ${sample[b]}`), `${a} AND ${b}`).toBe(worst);
        expect(licenseFamily(`${sample[a]} / ${sample[b]}`), `${a} / ${b}`).toBe(best);
      }
  });

  it('is case-insensitive and tolerates spacing', () => {
    expect(licenseFamily('  mit  ')).toBe('permissive');
    expect(licenseFamily('apache-2.0 or gpl-2.0')).toBe('permissive');
    expect(licenseFamily('lgpl-2.1-or-later and mit')).toBe('weak-copyleft');
  });
});

describe('answers filled by rules are valid options', () => {
  const invalid = (id: string, value: string | string[]) => {
    const q = findQuestion(id);
    if (!q) return [`${id}: unknown question`];
    if (q.kind === 'switch')
      return ['yes', 'no'].includes(String(value)) ? [] : [`${id}: ${value}`];
    if (!q.options?.length) return [];
    const values = Array.isArray(value)
      ? value
      : q.kind === 'multi'
        ? (JSON.parse(value) as string[])
        : [value];
    const options = q.options.map((o) => o.en);
    return values.filter((v) => !options.includes(v)).map((v) => `${id}: "${v}"`);
  };

  it('holds for answers implied by every seeded technology', () => {
    const problems = catalogSeed.flatMap((t) => {
      const spec = createSpec(crypto.randomUUID(), t.name);
      spec.stack = [{ technologyId: t.id, layer: t.layers[0], version: '', note: '' }];
      return (stackAnswerSuggestions(spec, catalogSeed, 'en').sections ?? []).flatMap((s) =>
        Object.entries(s.answers ?? {}).flatMap(([id, a]) =>
          invalid(id, a!.value!).map((p) => `${t.name} → ${p}`),
        ),
      );
    });
    expect(problems).toEqual([]);
  });

  it('holds for answers detected by the import rules', () => {
    const repo = {
      'main.tf': 'terraform {\n  backend "local" {}\n}\n',
      'remote/main.tf': 'terraform {\n  backend "remote" {}\n}\n',
      'terragrunt.hcl': '',
      'Pulumi.yaml': 'name: x',
      'cdk.json': '{}',
      'main.bicep': '',
      'stack.yaml': 'AWSTemplateFormatVersion: "2010-09-09"',
      'ansible.cfg': '',
      'Chart.yaml': 'name: x',
      'kustomization.yaml': '',
      'xrd.yaml': 'apiVersion: apiextensions.crossplane.io/v1',
      'policy.rego': '',
      '.checkov.yml': '',
      'kyverno.yaml': 'apiVersion: kyverno.io/v1',
      'package.json': JSON.stringify({ license: 'Elastic-2.0' }),
    };
    const problems = analyzeRepository(repo).flatMap((f) =>
      Object.entries(f.answers ?? {}).flatMap(([id, v]) => invalid(id, v as string | string[])),
    );
    expect(problems).toEqual([]);
    expect(
      analyzeRepository(repo)
        .filter((f) => f.stack?.layer === 'iac')
        .map((f) => f.stack!.slug),
    ).toEqual(
      expect.arrayContaining([
        'terraform',
        'terragrunt',
        'pulumi',
        'aws-cdk',
        'bicep',
        'cloudformation',
        'ansible',
        'helm',
        'kustomize',
        'crossplane',
        'opa',
        'checkov',
        'kyverno',
      ]),
    );
  });

  it('maps every detected IaC slug to a seeded catalog entry', () => {
    for (const slug of [
      'terraform',
      'opentofu',
      'terragrunt',
      'pulumi',
      'aws-cdk',
      'bicep',
      'cloudformation',
      'ansible',
      'helm',
      'kustomize',
      'crossplane',
      'opa',
      'checkov',
      'kyverno',
    ])
      expect(catalogSeed.find((t) => t.id === seedSlugs.get(slug))?.layers, slug).toContain('iac');
  });
});

describe('license rules', () => {
  it('reads the policy from the governance answers', () => {
    const policy = licensePolicy(
      governed({
        'governance.8': 'Proprietary (all rights reserved)',
        'governance.9': 'Hosted service (SaaS)',
        'governance.10': JSON.stringify([
          'Permissive (MIT, BSD, Apache-2.0, ISC)',
          'Weak copyleft (LGPL, MPL, EPL)',
        ]),
      }),
    );
    expect(policy).toEqual({
      projectLicense: 'Proprietary (all rights reserved)',
      distribution: 'Hosted service (SaaS)',
      allowed: ['permissive', 'standard', 'weak-copyleft'],
    });
    expect(licensePolicy(createSpec(crypto.randomUUID(), 'Empty'))).toEqual({
      projectLicense: '',
      distribution: '',
      allowed: [],
    });
  });

  it('blocks a GPL library in distributed proprietary software but not in internal tools', () => {
    const stack = [tech('ReadLine', 'GPL-3.0', 'library'), tech('React', 'MIT')];
    const shipped = licenseFindings(stack, {
      projectLicense: 'Proprietary (all rights reserved)',
      distribution: 'Distributed binaries or installers',
      allowed: [],
    });
    expect(shipped.map((f) => [f.technology, f.rule, f.severity])).toEqual([
      ['ReadLine', 'copyleft-distribution', 'blocker'],
    ]);
    expect(
      licenseFindings(stack, {
        projectLicense: 'Proprietary (all rights reserved)',
        distribution: 'Internal use only',
        allowed: [],
      }),
    ).toEqual([]);
    expect(
      licenseFindings(stack, {
        projectLicense: 'GPL-3.0',
        distribution: 'Distributed binaries or installers',
        allowed: [],
      }),
    ).toEqual([]);
  });

  it('separates AGPL code in the product from AGPL services beside it', () => {
    const policy = {
      projectLicense: 'Proprietary (all rights reserved)',
      distribution: 'Hosted service (SaaS)',
      allowed: [],
    };
    const findings = licenseFindings(
      [tech('Linked', 'AGPL-3.0', 'framework'), tech('Grafana', 'AGPL-3.0', 'observability')],
      policy,
    );
    expect(findings.map((f) => [f.technology, f.severity])).toEqual([
      ['Linked', 'blocker'],
      ['Grafana', 'warning'],
    ]);
  });

  it('flags licenses outside the allow-list, source-available terms and unrecorded licenses', () => {
    const findings = licenseFindings(
      [
        tech('Redis', 'AGPL-3.0 / SSPL-1.0 / RSALv2', 'database'),
        tech('Mystery', ''),
        tech('OpenAPI', 'Apache-2.0', 'contract'),
      ],
      {
        projectLicense: 'MIT',
        distribution: 'Internal use only',
        allowed: ['permissive', 'standard'],
      },
    );
    expect(findings.map((f) => [f.technology, f.rule])).toEqual([
      ['Redis', 'not-allowed'],
      ['Mystery', 'unknown'],
    ]);
    for (const f of findings) expect(f.message.fr).toBeTruthy();
  });

  it('recognises LICENSE files and maps them to governance.8 options', () => {
    expect(licenseFromText('Permission is hereby granted, free of charge, to any person')).toBe(
      'MIT',
    );
    expect(licenseFromText('Apache License\nVersion 2.0, January 2004')).toBe('Apache-2.0');
    expect(licenseFromText('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3')).toBe('AGPL-3.0');
    expect(licenseFromText('Business Source License 1.1')).toBe('BUSL-1.1');
    expect(licenseFromText('All rights reserved.')).toBeUndefined();
    expect(projectLicenseOption('UNLICENSED')).toBe('Proprietary (all rights reserved)');
    expect(projectLicenseOption('GPL-3.0-or-later')).toBe('GPL-3.0');
    expect(projectLicenseOption('Elastic-2.0')).toBe('Source-available (BUSL, Elastic, …)');
    const options = findQuestion('governance.8')!.options!.map((o) => o.en);
    for (const spdx of ['MIT', 'Apache-2.0', 'UNLICENSED', 'AGPL-3.0', 'BUSL-1.1'])
      expect(options).toContain(projectLicenseOption(spdx));
  });
});

describe('infrastructure as code', () => {
  const repo = {
    'infra/main.tf':
      'terraform {\n  backend "s3" {\n    bucket = "state"\n  }\n}\nprovider "aws" {\n  region = "ca-central-1"\n}\n',
    'infra/policy/deny.rego': 'package main\ndeny[msg] { true }',
    'deploy/chart/Chart.yaml': 'apiVersion: v2\nname: web\n',
    'Pulumi.yaml': 'name: platform\nruntime: nodejs\n',
    LICENSE: 'Apache License\n Version 2.0, January 2004\n',
  };

  it('detects tools, state backend, providers and policy checks', () => {
    const findings = analyzeRepository(repo);
    const stack = findings.filter((f) => f.stack).map((f) => `${f.stack!.slug}:${f.stack!.layer}`);
    expect(stack).toEqual(
      expect.arrayContaining([
        'terraform:iac',
        'aws:infrastructure',
        'helm:iac',
        'pulumi:iac',
        'opa:iac',
      ]),
    );
    expect(findings.find((f) => f.answers?.['delivery.16'])?.answers?.['delivery.16']).toBe(
      'Remote backend with locking (object storage)',
    );
    expect(findings.find((f) => f.rule === 'licenses')).toMatchObject({
      evidence: 'LICENSE: Apache-2.0',
      answers: { 'governance.8': 'Apache-2.0' },
    });
  });

  it('prefers OpenTofu when .tofu files or the OpenTofu registry are used', () => {
    const slugs = (files: Record<string, string>) =>
      analyzeRepository(files).flatMap((f) => (f.stack ? [f.stack.slug] : []));
    expect(slugs({ 'main.tofu': 'resource "null_resource" "x" {}' })).toContain('opentofu');
    expect(
      slugs({
        'main.tf': 'resource "null_resource" "x" {}',
        '.terraform.lock.hcl': 'provider "registry.opentofu.org/hashicorp/null" {}',
      }),
    ).toContain('opentofu');
  });

  it('merges every detected tool into one reviewable delivery.15 answer', () => {
    const spec = createSpec(crypto.randomUUID(), 'Infra');
    const next = applySpecPatch(
      spec,
      findingsToPatch(spec, catalogSeed, analyzeRepository(repo), 'en'),
      'importer',
    );
    const answer = (id: string) =>
      next.sections.find((s) => s.id === id.split('.')[0])!.answers[id]?.value;
    expect(JSON.parse(answer('delivery.15')!)).toEqual(
      expect.arrayContaining(['Terraform', 'Helm', 'Pulumi']),
    );
    expect(answer('delivery.13')).toBe('yes');
    expect(answer('governance.8')).toBe('Apache-2.0');
    expect(
      next.stack.some((e) => e.layer === 'iac' && e.technologyId === seedSlugs.get('terraform')),
    ).toBe(true);
  });

  it('fills IaC answers from the chosen stack', () => {
    const spec = createSpec(crypto.randomUUID(), 'Stacked');
    spec.stack = [
      { technologyId: seedSlugs.get('opentofu')!, layer: 'iac', version: '', note: '' },
      { technologyId: seedSlugs.get('checkov')!, layer: 'iac', version: '', note: '' },
    ];
    const answers = Object.assign(
      {},
      ...(stackAnswerSuggestions(spec, catalogSeed, 'en').sections ?? []).map((s) => s.answers),
    );
    expect(answers['delivery.13'].value).toBe('yes');
    expect(JSON.parse(answers['delivery.15'].value)).toEqual(['OpenTofu']);
    expect(JSON.parse(answers['delivery.19'].value)).toEqual(['Checkov']);
  });
});
