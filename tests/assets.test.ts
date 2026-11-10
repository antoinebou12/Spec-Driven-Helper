import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => {
  h = await setupApp('assets');
});
afterAll(async () => h?.teardown());

async function storeAsset(projectId: string, body: string) {
  const { assets } = await import('../apps/api/src/db');
  const upload = assets.openUploadStream('report.pdf', { metadata: { projectId, mime: 'application/pdf', approved: false } });
  await new Promise<void>((resolve, reject) => upload.end(Buffer.from(body), (e?: Error | null) => (e ? reject(e) : resolve())));
  return String(upload.id);
}

describe('generated assets', () => {
  it('downloads and approves assets only inside their project', async () => {
    const p = await h.createProject();
    const other = await h.createProject();
    const id = await storeAsset(p.id, '%PDF-1.7 test');
    const download = await h.request('GET', `/projects/${p.id}/assets/${id}`);
    expect(download.statusCode).toBe(200);
    expect(download.body).toBe('%PDF-1.7 test');
    expect(download.headers['content-disposition']).toContain('report.pdf');
    expect((await h.request('GET', `/projects/${other.id}/assets/${id}`)).statusCode).toBe(404);
    expect((await h.request('GET', `/projects/${p.id}/assets/not-an-id`)).statusCode).toBe(400);

    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    expect((await h.request('POST', `/projects/${p.id}/assets/${id}/approve`, {}, viewer.cookie)).statusCode).toBe(403);
    expect((await h.request('POST', `/projects/${p.id}/assets/${id}/approve`, {})).statusCode).toBe(200);
    const { db } = await import('../apps/api/src/db');
    const { assetKey } = await import('../apps/api/src/db');
    expect((await db.collection('assets.files').findOne({ _id: assetKey(id) as never }))?.metadata.approved).toBe(true);
  });
});
