import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';
import { seedSlugs } from '../apps/api/src/catalog-seed';

describe('migration 006: infrastructure-as-code catalog', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('migrations');
  });
  afterAll(async () => h?.teardown());

  it('moves seed-owned tools to the iac category, keeps team edits and adds missing tools', async () => {
    const technologies = h.db.collection('technologies');
    const terraform = seedSlugs.get('terraform')!;
    const helm = seedSlugs.get('helm')!;
    const pulumi = seedSlugs.get('pulumi')!;
    await technologies.updateOne(
      { id: terraform },
      { $set: { category: 'cloud', layers: ['infrastructure', 'cicd'] } },
    );
    await technologies.updateOne(
      { id: helm },
      { $set: { category: 'cloud', layers: ['infrastructure'], source: 'custom' } },
    );
    await technologies.deleteOne({ id: pulumi });
    await h.db.collection('migrations').deleteOne({ id: '006-catalog-iac-and-policy' });

    await (await import('../apps/api/src/migrations')).migrate();

    const tf = await technologies.findOne({ id: terraform });
    expect(tf).toMatchObject({ category: 'iac' });
    expect([...(tf!.layers as string[])].sort()).toEqual(['cicd', 'iac', 'infrastructure']);
    expect(await technologies.findOne({ id: helm })).toMatchObject({
      category: 'cloud',
      layers: ['infrastructure'],
    });
    expect(await technologies.findOne({ id: pulumi })).toMatchObject({
      name: 'Pulumi',
      category: 'iac',
      layers: ['iac'],
    });
    expect(
      await h.db.collection('migrations').findOne({ id: '006-catalog-iac-and-policy' }),
    ).toBeTruthy();
  });

  it('migration 007 moves search and development tools, keeps team edits and adds cloud services', async () => {
    const technologies = h.db.collection('technologies');
    const elasticsearch = seedSlugs.get('elasticsearch')!;
    const eslint = seedSlugs.get('eslint')!;
    const added = ['aws-lambda', 'azure-ai-search', 'opensearch', 'ruff'].map((slug) => seedSlugs.get(slug)!);
    await technologies.updateOne({ id: elasticsearch }, { $set: { category: 'database', layers: ['data'] } });
    await technologies.updateOne({ id: eslint }, { $set: { category: 'tooling', layers: ['testing'], source: 'custom' } });
    await technologies.deleteMany({ id: { $in: added } });
    await h.db.collection('migrations').deleteOne({ id: '007-catalog-cloud-search-development' });

    await (await import('../apps/api/src/migrations')).migrate();

    expect(await technologies.findOne({ id: elasticsearch })).toMatchObject({ category: 'search', layers: ['data'] });
    expect(await technologies.findOne({ id: eslint })).toMatchObject({ category: 'tooling', layers: ['testing'] });
    const inserted = await technologies.find({ id: { $in: added } }).toArray();
    expect(inserted.map((t) => [t.name, t.category]).sort()).toEqual([
      ['AWS Lambda', 'platform'],
      ['Azure AI Search', 'search'],
      ['OpenSearch', 'search'],
      ['Ruff', 'development'],
    ]);
  });

  it('migration 008 gives every earlier project the complete level, and old documents read as complete before it runs', async () => {
    const p = await h.createProject({ name: 'Before levels' });
    await h.db.collection('projects').updateOne({ id: p.id }, { $unset: { 'spec.level': '' } });
    expect((await h.db.collection('projects').findOne({ id: p.id }))!.spec.level).toBeUndefined();
    // A document without the field is read through the schema default.
    expect((await h.project(p.id)).spec.level).toBe('complete');
    await h.db.collection('migrations').deleteOne({ id: '008-spec-level' });

    await (await import('../apps/api/src/migrations')).migrate();

    expect((await h.db.collection('projects').findOne({ id: p.id }))!.spec.level).toBe('complete');
    expect(await h.db.collection('migrations').findOne({ id: '008-spec-level' })).toBeTruthy();
  });
});
