import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Kubernetes integration test of the Helm chart: starts k3s in Docker, loads the current image,
 * runs PostgreSQL with pgvector in the cluster, installs the chart with Helm, runs `helm test`,
 * then signs in, creates a project and reads the docs and llms.txt through the Service.
 * Run: `docker build -f docker/local.Dockerfile -t sdd-studio:ci . && pnpm k8s:test` (needs Docker with privileged containers).
 * K8S_KEEP=1 leaves the cluster running for inspection.
 */
const cluster = 'sdd-k3s-test';
const image = process.env.K8S_IMAGE ?? 'sdd-studio:ci';
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const kubectl = (...args: string[]) => docker('exec', cluster, 'kubectl', ...args);
const dir = mkdtempSync(join(tmpdir(), 'sdd-k8s-'));
const helm = (...args: string[]) =>
  docker('run', '--rm', '--network', `container:${cluster}`, '-v', `${resolve('deploy', 'helm')}:/charts`, '-v', `${dir}:/kube`, '-e', 'KUBECONFIG=/kube/kubeconfig', 'alpine/helm:3.18.4', ...args);
const step = (label: string) => console.log(`… ${label}`);
let failed = false;

try {
  step('starting k3s');
  try {
    docker('rm', '-f', cluster);
  } catch {
    /* not running */
  }
  docker('run', '-d', '--name', cluster, '--privileged', 'rancher/k3s:v1.31.4-k3s1', 'server', '--disable', 'traefik', '--disable', 'metrics-server');
  for (let i = 0; ; i++) {
    try {
      if (/ Ready /.test(kubectl('get', 'nodes'))) break;
    } catch {
      /* starting */
    }
    if (i > 60) throw new Error('k3s did not become ready');
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},2000)']);
  }
  writeFileSync(join(dir, 'kubeconfig'), docker('exec', cluster, 'cat', '/etc/rancher/k3s/k3s.yaml'));

  step(`loading ${image}`);
  execFileSync('sh', ['-c', `docker save ${image} | docker exec -i ${cluster} ctr images import -`], { stdio: 'ignore' });

  step('starting PostgreSQL with pgvector');
  kubectl('create', 'namespace', 'sdd');
  kubectl('-n', 'sdd', 'run', 'postgres', '--image=pgvector/pgvector:pg17', '--env=POSTGRES_USER=sdd', '--env=POSTGRES_PASSWORD=pw', '--env=POSTGRES_DB=sdd', '--port=5432');
  kubectl('-n', 'sdd', 'expose', 'pod', 'postgres', '--port=5432');
  kubectl('-n', 'sdd', 'wait', '--for=condition=Ready', 'pod/postgres', '--timeout=180s');
  kubectl('-n', 'sdd', 'exec', 'postgres', '--', 'sh', '-c', 'until pg_isready -U sdd; do sleep 1; done; psql -U sdd -d sdd -qc "CREATE EXTENSION IF NOT EXISTS vector"');

  step('helm install');
  const [repository, tag] = image.includes(':') ? image.split(':') : [image, 'latest'];
  helm('install', 'sdd', '/charts/sdd-studio', '-n', 'sdd', '--wait', '--timeout', '6m',
    '--set', `image.repository=docker.io/library/${repository}`, '--set', `image.tag=${tag}`, '--set', 'image.pullPolicy=Never',
    '--set', `secrets.encryptionKey=${'a'.repeat(64)}`, '--set', 'secrets.bootstrapEmail=k8s@example.test', '--set', 'secrets.bootstrapPassword=k8s-only-password-123',
    '--set', 'database.url=postgresql://sdd:pw@postgres:5432/sdd', '--set', 'appOrigin=http://localhost:3001');
  console.log(kubectl('-n', 'sdd', 'get', 'pods').trim());

  step('helm test');
  const test = helm('test', 'sdd', '-n', 'sdd');
  if (!/Phase:\s+Succeeded/.test(test)) throw new Error(`helm test failed:\n${test}`);

  step('sign in, create a project, read docs and llms.txt through the Service');
  const script = `const base='http://sdd-sdd-studio';(async()=>{const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3001'},body:JSON.stringify({email:'k8s@example.test',password:'k8s-only-password-123'})});const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');const p=await(await fetch(base+'/api/v1/projects',{method:'POST',headers:{cookie,Origin:'http://localhost:3001','Content-Type':'application/json'},body:JSON.stringify({name:'On Kubernetes',sample:true})})).json();const spec=await(await fetch(base+'/api/v1/projects/'+p.id,{headers:{cookie}})).json();const ok=login.status===200&&spec.spec?.name==='On Kubernetes'&&(await fetch(base+'/docs/')).ok&&(await fetch(base+'/llms.txt')).ok;console.log(JSON.stringify({login:login.status,project:spec.spec?.name,ok}));process.exit(ok?0:1)})().catch(e=>{console.error(e);process.exit(1)})`;
  console.log(kubectl('-n', 'sdd', 'run', 'e2e', '--rm', '-i', '--restart=Never', `--image=docker.io/library/${image}`, '--image-pull-policy=Never', '--command', '--', 'node', '-e', script).trim());
  console.log('\nKubernetes integration test passed.');
} catch (error) {
  failed = true;
  const e = error as { stdout?: string; stderr?: string; message: string };
  console.error(`\nKubernetes integration test FAILED: ${e.message}\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  try {
    console.error(kubectl('-n', 'sdd', 'get', 'pods,events'));
  } catch {
    /* cluster not reachable */
  }
} finally {
  if (!process.env.K8S_KEEP)
    try {
      docker('rm', '-f', cluster);
    } catch {
      /* already gone */
    }
}
process.exit(failed ? 1 : 0);
