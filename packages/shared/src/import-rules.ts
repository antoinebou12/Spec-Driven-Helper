import type { Localized } from './templates';
import type { StackLayer } from './schema';
import { licenseFromText, projectLicenseOption } from './licenses';

/**
 * Rule-based repository analysis. Each rule inspects file paths and contents and reports
 * findings with the evidence (file) that triggered them. Rules never read secret files.
 */
export type Files = Record<string, string>;
export type Finding = {
  rule: string;
  evidence: string;
  stack?: { slug: string; layer: StackLayer; version?: string };
  answers?: Record<string, string[] | string>;
  description?: string;
};
export type RepositoryRule = { id: string; title: Localized; detect: (files: Files) => Finding[] };

/** Files that may hold credentials are never analysed or sent anywhere. */
export const secretFile =
  /(^|\/)(\.env(\.[\w-]+)?|id_rsa|id_ed25519|[^/]*\.(pem|key|p12|pfx|keystore|jks)|credentials(\.json)?|secrets?\.(ya?ml|json)|[^/]*\.tfstate(\.backup)?|[^/]*\.tfvars(\.json)?|\.terraformrc|terraform\.rc|kubeconfig(\.ya?ml)?|\.kube\/config|\.vault-token|\.npmrc|\.pypirc|\.netrc|\.git-credentials)$/i;
export const safeFiles = (files: Files): Files =>
  Object.fromEntries(Object.entries(files).filter(([path]) => !secretFile.test(path) || /\.env\.(example|sample|template)$/i.test(path)));

const L = (en: string, fr: string): Localized => ({ en, fr });
const byName = (files: Files, pattern: RegExp) => Object.keys(files).filter((p) => pattern.test(p));
const major = (range: string | undefined) => range?.match(/(\d+)(?:\.(\d+))?/)?.slice(1).filter(Boolean).join('.');
const majorOnly = (range: string | undefined) => range?.match(/(\d+)/)?.[1];

function packageJsonFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const deps: [string, { slug: string; layer: StackLayer }][] = [
    ['react', { slug: 'react', layer: 'frontend' }],
    ['@angular/core', { slug: 'angular', layer: 'frontend' }],
    ['vue', { slug: 'vue', layer: 'frontend' }],
    ['svelte', { slug: 'svelte', layer: 'frontend' }],
    ['next', { slug: 'nextjs', layer: 'frontend' }],
    ['react-native', { slug: 'react-native', layer: 'mobile' }],
    ['electron', { slug: 'electron', layer: 'desktop' }],
    ['@tauri-apps/api', { slug: 'tauri', layer: 'desktop' }],
    ['express', { slug: 'express', layer: 'backend' }],
    ['fastify', { slug: 'fastify', layer: 'backend' }],
    ['@nestjs/core', { slug: 'nestjs', layer: 'backend' }],
    ['typescript', { slug: 'typescript', layer: 'frontend' }],
    ['vite', { slug: 'vite', layer: 'frontend' }],
    ['tailwindcss', { slug: 'tailwind', layer: 'frontend' }],
    ['jest', { slug: 'jest', layer: 'testing' }],
    ['vitest', { slug: 'vitest', layer: 'testing' }],
    ['@playwright/test', { slug: 'playwright', layer: 'testing' }],
    ['storybook', { slug: 'storybook', layer: 'testing' }],
    ['eslint', { slug: 'eslint', layer: 'testing' }],
    ['mongodb', { slug: 'mongodb', layer: 'data' }],
    ['mongoose', { slug: 'mongodb', layer: 'data' }],
    ['pg', { slug: 'postgresql', layer: 'data' }],
    ['mysql2', { slug: 'mysql', layer: 'data' }],
    ['redis', { slug: 'redis', layer: 'data' }],
    ['ioredis', { slug: 'redis', layer: 'data' }],
    ['kafkajs', { slug: 'kafka', layer: 'communication' }],
    ['amqplib', { slug: 'rabbitmq', layer: 'communication' }],
    ['graphql', { slug: 'graphql', layer: 'communication' }],
    ['ws', { slug: 'websockets', layer: 'communication' }],
    ['socket.io', { slug: 'websockets', layer: 'communication' }],
    ['@grpc/grpc-js', { slug: 'grpc', layer: 'communication' }],
    ['@opentelemetry/api', { slug: 'opentelemetry', layer: 'observability' }],
    ['@anthropic-ai/sdk', { slug: 'claude', layer: 'ai' }],
    ['openai', { slug: 'openai', layer: 'ai' }],
    ['ollama', { slug: 'ollama', layer: 'ai' }],
  ];
  for (const path of byName(files, /(^|\/)package\.json$/)) {
    if (path.includes('node_modules/')) continue;
    let pkg: any;
    try {
      pkg = JSON.parse(files[path]);
    } catch {
      continue;
    }
    const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies } as Record<string, string>;
    for (const [dep, target] of deps)
      if (all[dep]) out.push({ rule: 'node-packages', evidence: `${path}: ${dep}@${all[dep]}`, stack: { ...target, version: majorOnly(all[dep]) } });
    if (pkg.engines?.node || Object.keys(all).length)
      out.push({ rule: 'node-packages', evidence: `${path}: Node.js project`, stack: { slug: 'nodejs', layer: 'backend', version: majorOnly(pkg.engines?.node) } });
    if (pkg.description && !path.includes('/'))
      out.push({ rule: 'node-packages', evidence: `${path}: description`, description: String(pkg.description).slice(0, 500) });
  }
  return out;
}

function pythonFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const text = byName(files, /(^|\/)(requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|setup\.cfg)$/)
    .map((p) => ({ p, c: files[p].toLowerCase() }));
  const found = (name: string) => text.find(({ c }) => new RegExp(`(^|[\\s"'\\[])${name}\\b`, 'm').test(c));
  for (const [name, slug, layer] of [
    ['django', 'django', 'backend'],
    ['fastapi', 'fastapi', 'backend'],
    ['flask', 'flask', 'backend'],
    ['pytest', 'pytest', 'testing'],
    ['psycopg', 'postgresql', 'data'],
    ['pymongo', 'mongodb', 'data'],
    ['redis', 'redis', 'data'],
    ['celery', 'rabbitmq', 'communication'],
  ] as const) {
    const hit = found(name);
    if (hit) {
      const version = hit.c.match(new RegExp(`${name}\\s*[=~><!]=?\\s*"?(\\d+(?:\\.\\d+)?)`))?.[1];
      out.push({ rule: 'python-packages', evidence: `${hit.p}: ${name}`, stack: { slug, layer, version } });
    }
  }
  if (text.length) {
    const req = text.map(({ c }) => c.match(/requires-python\s*=\s*"[^"\d]*(\d+\.\d+)/)?.[1]).find(Boolean);
    const pinned = files['.python-version']?.trim().match(/^(\d+\.\d+)/)?.[1];
    out.push({ rule: 'python-packages', evidence: text[0].p, stack: { slug: 'python', layer: 'backend', version: pinned ?? req } });
  }
  return out;
}

function dotnetFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  for (const path of byName(files, /\.(cs|fs|vb)proj$/)) {
    const c = files[path];
    const tf = c.match(/<TargetFrameworks?>\s*net(\d+)\.\d/)?.[1];
    out.push({ rule: 'dotnet-projects', evidence: path, stack: { slug: 'dotnet', layer: 'backend', version: tf } });
    out.push({ rule: 'dotnet-projects', evidence: path, stack: { slug: 'csharp', layer: 'backend' } });
    if (/Microsoft\.NET\.Sdk\.Web|Microsoft\.AspNetCore/.test(c)) out.push({ rule: 'dotnet-projects', evidence: `${path}: web SDK`, stack: { slug: 'aspnet-core', layer: 'backend', version: tf } });
    if (/<UseMaui>\s*true/i.test(c)) out.push({ rule: 'dotnet-projects', evidence: `${path}: UseMaui`, stack: { slug: 'maui', layer: 'mobile', version: tf } });
    if (/<UseWPF>\s*true/i.test(c)) out.push({ rule: 'dotnet-projects', evidence: `${path}: UseWPF`, stack: { slug: 'wpf', layer: 'desktop' } });
    if (/xunit/i.test(c)) out.push({ rule: 'dotnet-projects', evidence: `${path}: xunit`, stack: { slug: 'xunit', layer: 'testing' } });
    if (/Blazor|Microsoft\.AspNetCore\.Components/.test(c)) out.push({ rule: 'dotnet-projects', evidence: `${path}: Blazor`, stack: { slug: 'blazor', layer: 'frontend', version: tf ? `.NET ${tf}` : undefined } });
  }
  return out;
}

function jvmFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  for (const path of byName(files, /(^|\/)(pom\.xml|build\.gradle(\.kts)?|settings\.gradle(\.kts)?)$/)) {
    const c = files[path];
    const java = c.match(/<java\.version>\s*(\d+)|(?:sourceCompatibility|targetCompatibility)\s*=?\s*(?:JavaVersion\.VERSION_)?['"]?(\d+)|jvmToolchain\((\d+)\)|languageVersion\.set\(JavaLanguageVersion\.of\((\d+)\)\)/);
    const javaVersion = java?.slice(1).find(Boolean);
    if (/spring-boot/.test(c))
      out.push({ rule: 'jvm-builds', evidence: `${path}: Spring Boot`, stack: { slug: 'spring-boot', layer: 'backend', version: major(c.match(/spring-boot[^\d]{0,80}(\d+\.\d+)/)?.[1]) } });
    if (/kotlin/i.test(c)) out.push({ rule: 'jvm-builds', evidence: `${path}: Kotlin`, stack: { slug: 'kotlin', layer: /com\.android/.test(c) ? 'mobile' : 'backend' } });
    if (/com\.android\.(application|library)/.test(c)) out.push({ rule: 'jvm-builds', evidence: `${path}: Android plugin`, stack: { slug: 'android', layer: 'mobile' } });
    if (/compose\s*(=\s*)?true|androidx\.compose/.test(c)) out.push({ rule: 'jvm-builds', evidence: `${path}: Jetpack Compose`, stack: { slug: 'jetpack-compose', layer: 'mobile' } });
    if (/junit/i.test(c)) out.push({ rule: 'jvm-builds', evidence: `${path}: JUnit`, stack: { slug: 'junit', layer: 'testing' } });
    if (javaVersion || /<project|plugins\s*\{/.test(c)) out.push({ rule: 'jvm-builds', evidence: path, stack: { slug: 'java', layer: 'backend', version: javaVersion } });
  }
  return out;
}

function nativeAndOtherFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const goMod = byName(files, /(^|\/)go\.mod$/)[0];
  if (goMod) out.push({ rule: 'other-languages', evidence: goMod, stack: { slug: 'go', layer: 'backend', version: files[goMod].match(/^go (\d+\.\d+)/m)?.[1] } });
  const cargo = byName(files, /(^|\/)Cargo\.toml$/)[0];
  if (cargo) out.push({ rule: 'other-languages', evidence: cargo, stack: { slug: 'rust', layer: 'backend' } });
  const cmake = byName(files, /(^|\/)CMakeLists\.txt$/)[0];
  if (cmake) {
    const std = files[cmake].match(/CMAKE_CXX_STANDARD\s+(\d+)/)?.[1];
    out.push({ rule: 'other-languages', evidence: cmake, stack: { slug: 'cpp', layer: 'desktop', version: std ? `C++${std}` : undefined } });
    if (/find_package\s*\(\s*Qt6/i.test(files[cmake])) out.push({ rule: 'other-languages', evidence: `${cmake}: Qt6`, stack: { slug: 'qt', layer: 'desktop' } });
  }
  const pubspec = byName(files, /(^|\/)pubspec\.yaml$/)[0];
  if (pubspec) out.push({ rule: 'other-languages', evidence: pubspec, stack: { slug: /flutter:/.test(files[pubspec]) ? 'flutter' : 'dart', layer: 'mobile' } });
  const swift = byName(files, /(^|\/)Package\.swift$|\.xcodeproj\//)[0];
  if (swift) out.push({ rule: 'other-languages', evidence: swift, stack: { slug: 'swift', layer: 'mobile' } });
  return out;
}

function infrastructureFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  for (const path of byName(files, /(^|\/)(Dockerfile[\w.-]*|Containerfile)$/)) {
    out.push({ rule: 'containers-and-infrastructure', evidence: path, stack: { slug: 'docker', layer: 'infrastructure' } });
    const base = files[path].match(/^FROM\s+(\S+)/im)?.[1] ?? '';
    const ubuntu = base.match(/ubuntu:(\d{2}\.\d{2})/)?.[1];
    if (ubuntu) out.push({ rule: 'containers-and-infrastructure', evidence: `${path}: FROM ${base}`, stack: { slug: 'ubuntu', layer: 'infrastructure', version: `${ubuntu} LTS` } });
    const node = base.match(/^node:(\d+)/)?.[1];
    if (node) out.push({ rule: 'containers-and-infrastructure', evidence: `${path}: FROM ${base}`, stack: { slug: 'nodejs', layer: 'backend', version: node } });
  }
  for (const path of byName(files, /(^|\/)(docker-)?compose(\.[\w-]+)?\.ya?ml$/)) {
    const c = files[path];
    out.push({ rule: 'containers-and-infrastructure', evidence: path, stack: { slug: 'docker', layer: 'infrastructure' } });
    for (const [pattern, slug, layer] of [
      [/image:\s*mongo(:|\s|$)/m, 'mongodb', 'data'],
      [/image:\s*postgres/m, 'postgresql', 'data'],
      [/image:\s*mysql/m, 'mysql', 'data'],
      [/image:\s*redis/m, 'redis', 'data'],
      [/image:\s*rabbitmq/m, 'rabbitmq', 'communication'],
      [/image:\s*\S*kafka/m, 'kafka', 'communication'],
      [/image:\s*nginx/m, 'nginx', 'infrastructure'],
    ] as const)
      if (pattern.test(c)) out.push({ rule: 'containers-and-infrastructure', evidence: `${path}: ${slug}`, stack: { slug, layer } });
  }
  const k8s = Object.keys(files).find((p) => /\.ya?ml$/.test(p) && /^kind:\s*(Deployment|StatefulSet|Service|Ingress)\b/m.test(files[p]) && /^apiVersion:/m.test(files[p]));
  if (k8s) out.push({ rule: 'containers-and-infrastructure', evidence: k8s, stack: { slug: 'kubernetes', layer: 'infrastructure' }, answers: { 'delivery.9': ['Kubernetes'] } });
  return out;
}

/** Infrastructure-as-code tools, their state backends and policy checks. */
function iacFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const iac = (evidence: string, slug: string, tool: string, extra: Finding['answers'] = {}) =>
    out.push({ rule: 'infrastructure-as-code', evidence, stack: { slug, layer: 'iac' }, answers: { 'delivery.13': 'yes', 'delivery.15': [tool], ...extra } });
  const tf = byName(files, /\.(tf|tofu)$/);
  if (tf.length) {
    const all = tf.map((p) => files[p]).join('\n');
    const lock = byName(files, /(^|\/)\.terraform\.lock\.hcl$/).map((p) => files[p]).join('\n');
    const tofu = tf.some((p) => p.endsWith('.tofu')) || /registry\.opentofu\.org/.test(lock);
    iac(tf[0], tofu ? 'opentofu' : 'terraform', tofu ? 'OpenTofu' : 'Terraform');
    const backend = all.match(/backend\s+"(\w+)"/)?.[1];
    if (backend)
      out.push({
        rule: 'infrastructure-as-code',
        evidence: `backend "${backend}"`,
        answers: { 'delivery.16': backend === 'local' ? 'Local state files (not recommended)' : backend === 'remote' || /\bcloud\s*\{/.test(all) ? 'HCP Terraform / Terraform Enterprise' : 'Remote backend with locking (object storage)' },
      });
    for (const [re, slug, label] of [
      [/provider\s+"aws"/, 'aws', 'aws'],
      [/provider\s+"azurerm"/, 'azure', 'azurerm'],
      [/provider\s+"google"/, 'gcp', 'google'],
    ] as const)
      if (re.test(all)) out.push({ rule: 'infrastructure-as-code', evidence: `Terraform provider ${label}`, stack: { slug, layer: 'infrastructure' } });
  }
  const first = (pattern: RegExp) => byName(files, pattern)[0];
  const found: [string | undefined, string, string][] = [
    [first(/(^|\/)terragrunt\.hcl$/), 'terragrunt', 'Terragrunt'],
    [first(/(^|\/)Pulumi\.ya?ml$/), 'pulumi', 'Pulumi'],
    [first(/(^|\/)cdk\.json$/), 'aws-cdk', 'AWS CDK'],
    [first(/\.bicep$/), 'bicep', 'Azure Bicep'],
    [Object.keys(files).find((p) => /\.(ya?ml|json|template)$/.test(p) && /AWSTemplateFormatVersion/.test(files[p].slice(0, 2000))), 'cloudformation', 'AWS CloudFormation'],
    [first(/(^|\/)(ansible\.cfg|playbook[\w-]*\.ya?ml|site\.ya?ml)$/) ?? first(/(^|\/)roles\/[^/]+\/tasks\/main\.ya?ml$/), 'ansible', 'Ansible'],
    [first(/(^|\/)Chart\.yaml$/), 'helm', 'Helm'],
    [first(/(^|\/)kustomization\.ya?ml$/), 'kustomize', 'Kustomize'],
    [Object.keys(files).find((p) => /\.ya?ml$/.test(p) && /^apiVersion:\s*\S*crossplane\.io\//m.test(files[p])), 'crossplane', 'Crossplane'],
  ];
  for (const [evidence, slug, tool] of found) if (evidence) iac(evidence, slug, tool);
  const policies: [string | undefined, string, string][] = [
    [first(/\.rego$/), 'opa', 'Open Policy Agent / Conftest'],
    [first(/(^|\/)\.checkov\.ya?ml$/), 'checkov', 'Checkov'],
    [Object.keys(files).find((p) => /\.ya?ml$/.test(p) && /^apiVersion:\s*kyverno\.io\//m.test(files[p])), 'kyverno', 'Kyverno'],
  ];
  for (const [evidence, slug, tool] of policies) if (evidence) out.push({ rule: 'infrastructure-as-code', evidence, stack: { slug, layer: 'iac' }, answers: { 'delivery.19': [tool] } });
  return out;
}

/** The project's own license, from LICENSE files and package manifests. */
function licenseRuleFindings(files: Files): Finding[] {
  const file = Object.keys(files).find((p) => /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i.test(p));
  const fromFile = file ? licenseFromText(files[file]) : undefined;
  const manifest = (() => {
    try {
      const pkg = files['package.json'] && JSON.parse(files['package.json']);
      if (typeof pkg?.license === 'string') return { evidence: 'package.json license', spdx: pkg.license as string };
    } catch {
      /* not JSON */
    }
    const toml = (files['pyproject.toml'] ?? '') + '\n' + (files['Cargo.toml'] ?? '');
    const m = toml.match(/^\s*license\s*=\s*(?:\{\s*text\s*=\s*)?"([^"]+)"/m);
    return m ? { evidence: files['Cargo.toml']?.includes(m[0]) ? 'Cargo.toml license' : 'pyproject.toml license', spdx: m[1] } : undefined;
  })();
  const spdx = fromFile ?? manifest?.spdx;
  if (!spdx) return [];
  return [{ rule: 'licenses', evidence: `${fromFile ? file : manifest!.evidence}: ${spdx}`, answers: { 'governance.8': projectLicenseOption(spdx) } }];
}

const stagePatterns: [RegExp, string][] = [
  [/\b(lint|eslint|ruff|flake8|golangci)\b/i, 'Lint and format check'],
  [/\b(tsc|typecheck|mypy|pyright|dotnet build|mvn (compile|package)|gradle(w)? build)\b/i, 'Type check / compile'],
  [/\b(test|pytest|vitest|jest|dotnet test|gradle(w)? test|mvn test)\b/i, 'Unit tests'],
  [/\b(playwright|cypress|e2e)\b/i, 'End-to-end tests'],
  [/\b(codeql|semgrep|sonar)/i, 'Static analysis (SAST)'],
  [/\b(npm audit|pnpm audit|dependabot|snyk|pip-audit|osv-scanner)\b/i, 'Dependency scan'],
  [/\b(gitleaks|trufflehog|secret[- ]?scan)/i, 'Secret scan'],
  [/\b(trivy|grype)\b/i, 'Container image scan'],
  [/\b(docker (build|push)|buildx|build-push-action)\b/i, 'Build artifact / image'],
  [/\b(environment:\s*staging|deploy[-_ ]staging|staging)\b/i, 'Deploy to staging'],
  [/\b(environment:\s*production|deploy[-_ ]prod|production)\b/i, 'Deploy to production'],
];
function ciFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const pipelines: [string[], string, string][] = [
    [byName(files, /^\.github\/workflows\/[^/]+\.ya?ml$/), 'github-actions', 'GitHub Actions'],
    [byName(files, /(^|\/)\.gitlab-ci\.ya?ml$/), 'gitlab-ci', 'GitLab CI/CD'],
    [byName(files, /(^|\/)azure-pipelines[\w.-]*\.ya?ml$/), 'azure-pipelines', 'Azure Pipelines'],
    [byName(files, /(^|\/)Jenkinsfile$/), 'jenkins', 'Jenkins'],
  ];
  for (const [paths, slug, label] of pipelines) {
    if (!paths.length) continue;
    const text = paths.map((p) => files[p]).join('\n');
    const stages = stagePatterns.filter(([re]) => re.test(text)).map(([, s]) => s);
    out.push({ rule: 'ci-pipelines', evidence: paths.join(', '), stack: { slug, layer: 'cicd' }, answers: { 'delivery.11': label, ...(stages.length ? { 'delivery.12': stages } : {}) } });
  }
  return out;
}

function contractFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const openapi = Object.keys(files).find((p) => /\.(ya?ml|json)$/.test(p) && /["']?openapi["']?\s*:\s*["']?3\./.test(files[p].slice(0, 400)));
  if (openapi) out.push({ rule: 'api-contracts', evidence: openapi, stack: { slug: 'openapi', layer: 'contracts' }, answers: { 'data.11': ['OpenAPI'], 'data.10': ['Synchronous REST over HTTP'] } });
  const asyncapi = Object.keys(files).find((p) => /\.(ya?ml|json)$/.test(p) && /["']?asyncapi["']?\s*:/.test(files[p].slice(0, 400)));
  if (asyncapi) out.push({ rule: 'api-contracts', evidence: asyncapi, stack: { slug: 'asyncapi', layer: 'contracts' }, answers: { 'data.11': ['AsyncAPI'] } });
  const proto = byName(files, /\.proto$/)[0];
  if (proto) out.push({ rule: 'api-contracts', evidence: proto, stack: { slug: 'protobuf', layer: 'contracts' }, answers: { 'data.11': ['Protocol Buffers'], 'data.12': ['Protocol Buffers'], ...(/\bservice\s+\w+\s*\{/.test(files[proto]) ? { 'data.10': ['gRPC'] } : {}) } });
  const gql = byName(files, /\.(graphql|gql)$/)[0];
  if (gql) out.push({ rule: 'api-contracts', evidence: gql, stack: { slug: 'graphql', layer: 'contracts' }, answers: { 'data.11': ['GraphQL SDL'], 'data.10': ['GraphQL'] } });
  const schema = byName(files, /\.schema\.json$/)[0];
  if (schema) out.push({ rule: 'api-contracts', evidence: schema, stack: { slug: 'json-schema', layer: 'contracts' }, answers: { 'data.11': ['JSON Schema'], 'data.12': ['JSON'] } });
  return out;
}

function documentationFindings(files: Files): Finding[] {
  const out: Finding[] = [];
  const readme = Object.keys(files).find((p) => /^readme(\.md|\.txt)?$/i.test(p));
  if (readme) {
    const paragraph = files[readme]
      .replace(/^#.*$/gm, '')
      .replace(/!\[[^\]]*]\([^)]*\)|<[^>]+>/g, '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p.length > 40 && !p.startsWith('[') && !p.startsWith('```'));
    if (paragraph) out.push({ rule: 'documentation', evidence: readme, description: paragraph.replace(/\s+/g, ' ').slice(0, 800) });
  }
  const envExample = Object.keys(files).find((p) => /\.env\.(example|sample|template)$/i.test(p));
  if (envExample) {
    // Variable names only; values in example files are ignored.
    const names = [...files[envExample].matchAll(/^\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]);
    if (names.length) out.push({ rule: 'documentation', evidence: envExample, answers: { 'delivery.2': `Configuration variables documented in ${envExample}: ${names.join(', ')}.` } });
  }
  return out;
}

export const repositoryRules: RepositoryRule[] = [
  { id: 'node-packages', title: L('JavaScript/TypeScript packages (package.json)', 'Paquets JavaScript/TypeScript (package.json)'), detect: packageJsonFindings },
  { id: 'python-packages', title: L('Python projects (pyproject, requirements)', 'Projets Python (pyproject, requirements)'), detect: pythonFindings },
  { id: 'dotnet-projects', title: L('.NET projects (*.csproj)', 'Projets .NET (*.csproj)'), detect: dotnetFindings },
  { id: 'jvm-builds', title: L('Java, Kotlin and Android builds (Maven, Gradle)', 'Builds Java, Kotlin et Android (Maven, Gradle)'), detect: jvmFindings },
  { id: 'other-languages', title: L('Go, Rust, C/C++, Flutter and Swift projects', 'Projets Go, Rust, C/C++, Flutter et Swift'), detect: nativeAndOtherFindings },
  { id: 'containers-and-infrastructure', title: L('Containers and Kubernetes', 'Conteneurs et Kubernetes'), detect: infrastructureFindings },
  {
    id: 'infrastructure-as-code',
    title: L('Infrastructure as code (Terraform, OpenTofu, Pulumi, CloudFormation, CDK, Bicep, Ansible, Helm, Kustomize, Crossplane) and policy checks', 'Infrastructure en code (Terraform, OpenTofu, Pulumi, CloudFormation, CDK, Bicep, Ansible, Helm, Kustomize, Crossplane) et politiques'),
    detect: iacFindings,
  },
  { id: 'licenses', title: L('Project license (LICENSE file, package manifests)', 'Licence du projet (fichier LICENSE, manifestes)'), detect: licenseRuleFindings },
  { id: 'ci-pipelines', title: L('CI/CD pipelines and their stages', 'Pipelines CI/CD et leurs étapes'), detect: ciFindings },
  { id: 'api-contracts', title: L('API contracts (OpenAPI, AsyncAPI, Protobuf, GraphQL, JSON Schema)', 'Contrats d’API (OpenAPI, AsyncAPI, Protobuf, GraphQL, JSON Schema)'), detect: contractFindings },
  { id: 'documentation', title: L('README and documented configuration (.env.example names only)', 'README et configuration documentée (noms de .env.example seulement)'), detect: documentationFindings },
];

export function analyzeRepository(files: Files): Finding[] {
  const safe = safeFiles(files);
  return repositoryRules.flatMap((r) => r.detect(safe));
}
