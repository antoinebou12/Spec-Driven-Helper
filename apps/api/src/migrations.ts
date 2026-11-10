import { db, postgres } from './db';
import { log } from './observability';
import { specSchema, technologySchema } from '../../../packages/shared/src/schema';
import { catalogSeed } from './catalog-seed';

/**
 * Versioned, idempotent data migrations. Each runs once per database and is recorded in the
 * `migrations` collection. Approved baselines and revision snapshots are historical records and
 * are never rewritten; readers normalize them through the schema instead.
 */
async function normalizeSpecs() {
  let changed = 0;
  for await (const p of db.collection('projects').find({}, { projection: { id: 1, spec: 1 } })) {
    const parsed = specSchema.safeParse(p.spec);
    if (!parsed.success) {
      log.warn(
        { projectId: p.id },
        'project specification does not match the schema; left unchanged',
      );
      continue;
    }
    if (JSON.stringify(parsed.data) !== JSON.stringify(p.spec)) {
      await db
        .collection('projects')
        .updateOne({ id: p.id, 'spec.revision': p.spec.revision }, { $set: { spec: parsed.data } });
      changed++;
    }
  }
  return changed;
}

const migrations: { id: string; run: () => Promise<number> }[] = [
  // Fills fields added after the first release (item review flags, technology decisions).
  { id: '001-spec-defaults', run: normalizeSpecs },
  {
    id: '002-git-provider',
    run: async () =>
      (
        await db
          .collection('git')
          .updateMany({ provider: { $exists: false } }, { $set: { provider: 'github' } })
      ).modifiedCount,
  },
  {
    id: '003-catalog-seed',
    // Adds the starter catalog. Entries a team already has (same name) keep their ring,
    // rationale and history; they only gain missing versions, layers and icons.
    run: async () => {
      let changed = 0;
      for await (const t of db.collection('technologies').find({}, { projection: { _id: 0 } })) {
        const parsed = technologySchema.safeParse(t);
        if (!parsed.success) continue;
        const seed = catalogSeed.find(
          (s) => s.name.toLowerCase() === parsed.data.name.toLowerCase(),
        );
        const next =
          seed && !parsed.data.versions.length
            ? {
                ...parsed.data,
                category: seed.category,
                layers: seed.layers,
                versions: seed.versions,
                icon: seed.icon,
                tags: [seed.tags[0], ...parsed.data.tags.filter((x) => x !== seed.tags[0])],
                references: parsed.data.references.length
                  ? parsed.data.references
                  : seed.references,
              }
            : parsed.data;
        if (JSON.stringify(next) !== JSON.stringify(t)) {
          await db.collection('technologies').replaceOne({ id: t.id }, next);
          changed++;
        }
      }
      return changed + (await insertMissingSeeds());
    },
  },
  // Stack and custom questions.
  { id: '004-spec-stack-defaults', run: normalizeSpecs },
  {
    id: '005-seed-slug-tags',
    // Stack rules match catalog slugs; entries merged with the seed must carry the seed slug.
    run: async () => {
      let changed = 0;
      for (const seed of catalogSeed) {
        const slug = seed.tags[0];
        const r = await db
          .collection('technologies')
          .updateMany(
            {
              $expr: { $eq: [{ $toLower: '$name' }, seed.name.toLowerCase()] },
              'tags.0': { $ne: slug },
            },
            [
              {
                $set: {
                  tags: {
                    $concatArrays: [
                      [slug],
                      { $filter: { input: '$tags', cond: { $ne: ['$$this', slug] } } },
                    ],
                  },
                },
              },
            ],
          );
        changed += r.modifiedCount;
      }
      return changed;
    },
  },
  {
    id: '006-catalog-iac-and-policy',
    // Adds infrastructure-as-code and policy-as-code tools. Entries still owned by the seed gain the
    // new `iac` layer and category; entries a team created or edited keep their own values.
    run: async () => (await syncSeedCategories()) + (await insertMissingSeeds()),
  },
  {
    id: '007-catalog-cloud-search-development',
    // Adds the search, storage, networking, identity and development categories, the development
    // stack layer, AWS and Azure services, search engines and development tools.
    run: async () => (await syncSeedCategories()) + (await insertMissingSeeds()),
  },
  // Stored specifications gain the specification level; every earlier project keeps the complete level.
  { id: '008-spec-level', run: normalizeSpecs },
];

/** Entries still owned by the seed take its category and gain its layers; team edits are kept. */
async function syncSeedCategories() {
  let changed = 0;
  for (const seed of catalogSeed) {
    const current = await db.collection('technologies').findOne({ id: seed.id, source: 'seed' });
    if (!current) continue;
    const layers = [...new Set([...((current.layers as string[]) ?? []), ...seed.layers])];
    if (current.category === seed.category && layers.length === (current.layers ?? []).length) continue;
    await db.collection('technologies').updateOne({ id: seed.id, source: 'seed' }, { $set: { category: seed.category, layers } });
    changed++;
  }
  return changed;
}

/** Inserts seed entries whose name the workspace does not have yet. */
async function insertMissingSeeds() {
  let inserted = 0;
  const names = new Set(
    (await db.collection('technologies').find({}, { projection: { name: 1 } }).toArray()).map((t) => String(t.name).toLowerCase()),
  );
  for (const seed of catalogSeed)
    if (!names.has(seed.name.toLowerCase())) {
      const r = await db.collection('technologies').updateOne({ id: seed.id }, { $setOnInsert: seed }, { upsert: true });
      inserted += r.upsertedCount;
    }
  return inserted;
}

/** Another process recorded the same migration first (PostgreSQL 23505). */
const duplicate = (e: unknown) => ['11000', '23505'].includes(String((e as { code?: unknown })?.code));

export async function migrate() {
  // The API and worker start together; on PostgreSQL a session lock runs migrations one process at a time.
  const lock = postgres ? await postgres.pool.connect() : null;
  try {
    if (lock) await lock.query('SELECT pg_advisory_lock(hashtext($1))', [`sdd-migrations:${postgres!.databaseName}`]);
    await db.collection('migrations').createIndex({ id: 1 }, { unique: true });
    for (const m of migrations) {
      if (await db.collection('migrations').findOne({ id: m.id })) continue;
      const changed = await m.run();
      try {
        await db.collection('migrations').insertOne({ id: m.id, at: new Date().toISOString(), changed });
      } catch (e) {
        if (!duplicate(e)) throw e;
        continue;
      }
      log.info({ migration: m.id, changed }, 'migration applied');
    }
  } finally {
    if (lock) {
      await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [`sdd-migrations:${postgres!.databaseName}`]).catch(() => {});
      lock.release();
    }
  }
}
