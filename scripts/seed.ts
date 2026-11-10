import { connect, db, client } from '../apps/api/src/db';
import { bootstrap } from '../apps/api/src/security';
import { buildExampleSpec } from '../packages/shared/src/example';
import { exampleStack } from '../apps/api/src/specs';
import { migrate } from '../apps/api/src/migrations';

/** Creates the bootstrap owner (from .env) and the complete example project, once. */
await connect();
await migrate();
await bootstrap();
const owner = await db.collection('users').findOne({ role: 'Owner' });
if (!owner) throw new Error('Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD first');
if (await db.collection('projects').findOne({ 'spec.name': 'Customer Request Portal' })) {
  console.log('Example project already exists.');
} else {
  const spec = buildExampleSpec(crypto.randomUUID(), 'en', exampleStack());
  spec.updatedBy = owner.id;
  await db.collection('projects').insertOne({
    id: spec.id,
    spec,
    members: { [owner.id]: 'Owner' },
    aiRunLimit: 50,
    aiTokenBudget: 2_000_000,
  });
  await db.collection('revisions').insertOne({
    projectId: spec.id,
    revision: spec.revision,
    spec,
    author: owner.id,
    at: spec.updatedAt,
    provenance: { origin: 'example' },
    changes: [],
  });
  console.log(`Created example project “${spec.name}” (${spec.id}).`);
}
await client.close();
