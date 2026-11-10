import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Helm chart checks without installing Helm: `helm lint`, `helm template` with every optional
 * resource on, kubeconform against Kubernetes schemas, and the required-value guards.
 * Run: `pnpm helm:check` (needs Docker).
 */
const chart = resolve('deploy', 'helm');
const helm = (...args: string[]) =>
  execFileSync('docker', ['run', '--rm', '-v', `${chart}:/charts`, 'alpine/helm:3.18.4', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const all = ['--set', `secrets.encryptionKey=${'a'.repeat(64)}`, '--set', 'database.url=postgresql://sdd:pw@db:5432/sdd', '--set', 'ingress.enabled=true', '--set', 'networkPolicy.enabled=true', '--set', 'serviceMonitor.enabled=true'];
let failed = false;
const check = (label: string, ok: boolean, detail = '') => {
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
};

const lint = helm('lint', '/charts/sdd-studio', ...all);
check('helm lint', /0 chart\(s\) failed/.test(lint), lint);

const rendered = helm('template', 'sdd', '/charts/sdd-studio', ...all);
const kinds = [...rendered.matchAll(/^kind: (\w+)/gm)].map((m) => m[1]).sort();
check('renders API and worker deployments, service, ingress, secret, PDB, network policy, service monitor and test', kinds.join(',') === 'Deployment,Deployment,Ingress,NetworkPolicy,Pod,PodDisruptionBudget,Secret,Service,ServiceMonitor', kinds.join(','));
check('containers run as non-root with a read-only root file system and no capabilities', (rendered.match(/readOnlyRootFilesystem: true/g) ?? []).length >= 3 && (rendered.match(/runAsNonRoot: true/g) ?? []).length >= 3 && !/privileged: true/.test(rendered));
check('no secret value is rendered outside the Secret', rendered.split('kind: Secret')[0].indexOf('a'.repeat(64)) === -1 && rendered.split('\n---').filter((d) => !/kind: Secret/.test(d)).every((d) => !d.includes('a'.repeat(64))));

const dir = mkdtempSync(join(tmpdir(), 'sdd-helm-'));
writeFileSync(join(dir, 'rendered.yaml'), rendered);
const conform = execFileSync('docker', ['run', '--rm', '-v', `${dir}:/work`, 'ghcr.io/yannh/kubeconform:v0.7.0', '-strict', '-summary', '-ignore-missing-schemas', '-kubernetes-version', '1.31.0', '/work/rendered.yaml'], { encoding: 'utf8' });
check('kubeconform (Kubernetes 1.31 schemas)', /Invalid: 0, Errors: 0/.test(conform), conform.trim());

const refuses = (label: string, args: string[], message: RegExp) => {
  try {
    helm('template', 'sdd', '/charts/sdd-studio', ...args);
    check(label, false, 'rendered without error');
  } catch (error) {
    check(label, message.test(String((error as { stderr?: string }).stderr ?? error)), String((error as { stderr?: string }).stderr).slice(0, 200));
  }
};
refuses('refuses a missing encryption key', [], /Set secrets\.encryptionKey/);
refuses('refuses a malformed encryption key', ['--set', 'secrets.encryptionKey=short', '--set', 'database.url=x'], /64 hexadecimal/);
refuses('refuses a missing database', ['--set', `secrets.encryptionKey=${'a'.repeat(64)}`], /Set database\.url/);

console.log(failed ? '\nHelm chart checks: FAILED' : '\nHelm chart checks passed.');
process.exit(failed ? 1 : 0);
