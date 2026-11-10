import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { setupApp, type Harness } from './helpers';
let h:Harness;
beforeAll(async()=>{h=await setupApp('admin_search');});
afterAll(async()=>{await h.teardown();});
describe('administration boundaries',()=>{
  it('restricts configuration and stats to workspace administrators',async()=>{
    const viewer=await h.userWith('Viewer');
    for(const path of ['/admin/configuration','/admin/stats'])expect((await h.request('GET',path,undefined,viewer.cookie)).statusCode).toBe(403);
    expect((await h.request('PUT','/admin/configuration',{registration:true},viewer.cookie)).statusCode).toBe(403);
  });
  it('encrypts secrets, never returns them, and preserves them on ordinary edits',async()=>{
    const secret='test-google-secret-not-for-output';
    expect((await h.request('PUT','/admin/configuration',{googleClientId:'client',googleSecret:secret})).statusCode).toBe(200);
    const raw=await h.db.collection('configuration').findOne({id:'runtime'});
    expect(raw!.googleSecret).not.toContain(secret);
    let r=await h.request('GET','/admin/configuration');expect(r.body).not.toContain(secret);expect(r.json().googleSecretConfigured).toBe(true);
    await h.request('PUT','/admin/configuration',{googleClientId:'client',googleSecret:''});
    r=await h.request('GET','/admin/configuration');expect(r.json().googleSecretConfigured).toBe(true);
  });
  it('requires administrative activation for local registration',async()=>{
    await h.request('PUT','/admin/configuration',{registration:true});
    const credentials={email:'request@example.test',password:'test-request-password'};
    expect((await h.request('POST','/auth/signup',{...credentials,name:'Request'})).statusCode).toBe(200);
    expect((await h.request('POST','/auth/login',credentials)).statusCode).toBe(401);
    const user=await h.db.collection('users').findOne({email:credentials.email});
    await h.request('POST',`/admin/users/${user!.id}/activate`);
    expect((await h.request('POST','/auth/login',credentials)).statusCode).toBe(200);
  });
});
describe('section search',()=>{
  it('finds saved content, invalidates stale content and enforces project access',async()=>{
    if(!process.env.DATABASE_URL)return;
    const p=await h.createProject();await h.patch(p.id,p.revision,{sections:[{id:'architecture',markdown:'# Architecture\nQuasar routing contract'}]});
    const path=`/projects/${p.id}/search?q=Quasar`;
    const result=await h.request('GET',path);expect(result.statusCode,result.body).toBe(200);expect(result.json().results.map((r:any)=>r.section_id)).toContain('architecture');
    const outsider=await h.userWith('Viewer');expect((await h.request('GET',path,undefined,outsider.cookie)).statusCode).toBe(403);
    const reader=await h.userWith('Viewer',{projectId:p.id,role:'Viewer'});expect((await h.request('GET',path,undefined,reader.cookie)).statusCode).toBe(200);expect((await h.request('POST',`/projects/${p.id}/search/index`,undefined,reader.cookie)).statusCode).toBe(403);
    const latest=await h.project(p.id);await h.patch(p.id,latest.spec.revision,{sections:[{id:'architecture',markdown:'Changed design'}]});
    expect((await h.request('GET',path)).json().results).toHaveLength(0);
  });
});

