import type { CustomQuestion, Spec, SpecPatch, StackEntry, StackLayer, Technology } from './schema';
import type { Localized } from './templates';
import { languagesForStack, layoutMarkdown, namingMarkdown } from './conventions';

/**
 * Stack-driven assistance: layer metadata, answer suggestions derived from the chosen stack, and
 * rule-generated follow-up questions. Rules are plain data so teams can read exactly why a
 * question appeared.
 */
export const layerInfo: Record<StackLayer, { label: Localized; hint: Localized }> = {
  frontend: { label: { en: 'Web frontend', fr: 'Interface web' }, hint: { en: 'Frameworks, UI libraries, build tools', fr: 'Frameworks, bibliothèques UI, outils de build' } },
  backend: { label: { en: 'Backend & APIs', fr: 'Backend et API' }, hint: { en: 'Languages, runtimes, server frameworks', fr: 'Langages, environnements, frameworks serveur' } },
  mobile: { label: { en: 'Mobile', fr: 'Mobile' }, hint: { en: 'Android, iOS, cross-platform', fr: 'Android, iOS, multiplateforme' } },
  desktop: { label: { en: 'Desktop', fr: 'Bureau' }, hint: { en: 'Native and cross-platform desktop', fr: 'Bureau natif et multiplateforme' } },
  data: { label: { en: 'Data storage', fr: 'Stockage des données' }, hint: { en: 'Databases, caches, search', fr: 'Bases de données, caches, recherche' } },
  communication: { label: { en: 'Communication', fr: 'Communication' }, hint: { en: 'Sync APIs, messaging, streaming', fr: 'API synchrones, messagerie, flux' } },
  contracts: { label: { en: 'Contracts & formats', fr: 'Contrats et formats' }, hint: { en: 'OpenAPI, AsyncAPI, JSON Schema, Protobuf', fr: 'OpenAPI, AsyncAPI, JSON Schema, Protobuf' } },
  infrastructure: { label: { en: 'Hosting, cloud & VMs', fr: 'Hébergement, nuage et VM' }, hint: { en: 'Cloud providers, containers, operating systems', fr: 'Fournisseurs infonuagiques, conteneurs, systèmes' } },
  iac: { label: { en: 'Infrastructure as code', fr: 'Infrastructure en code' }, hint: { en: 'Provisioning, configuration, packaging, policy as code', fr: 'Provisionnement, configuration, empaquetage, politiques en code' } },
  cicd: { label: { en: 'CI/CD & pipeline', fr: 'CI/CD et pipeline' }, hint: { en: 'Pipelines, deployment, scanning', fr: 'Pipelines, déploiement, analyses' } },
  testing: { label: { en: 'Testing & quality', fr: 'Tests et qualité' }, hint: { en: 'Test runners, linters, component workshop', fr: 'Exécuteurs de tests, analyseurs, atelier de composants' } },
  observability: { label: { en: 'Observability', fr: 'Observabilité' }, hint: { en: 'Logs, metrics, traces', fr: 'Journaux, métriques, traces' } },
  ai: { label: { en: 'AI services', fr: 'Services d’IA' }, hint: { en: 'Model providers, local models', fr: 'Fournisseurs de modèles, modèles locaux' } },
  development: { label: { en: 'Development environment', fr: 'Environnement de développement' }, hint: { en: 'Editors, formatters, linters, package managers, build systems, Git hooks', fr: 'Éditeurs, formateurs, analyseurs, gestionnaires de paquets, systèmes de build, crochets Git' } },
};

export const categoryLabels: Record<Technology['category'], Localized> = {
  language: { en: 'Languages', fr: 'Langages' },
  framework: { en: 'Frameworks', fr: 'Frameworks' },
  runtime: { en: 'Runtimes', fr: 'Environnements' },
  library: { en: 'Libraries', fr: 'Bibliothèques' },
  database: { en: 'Databases', fr: 'Bases de données' },
  search: { en: 'Search', fr: 'Recherche' },
  storage: { en: 'Storage', fr: 'Stockage' },
  messaging: { en: 'Messaging', fr: 'Messagerie' },
  contract: { en: 'Contracts & protocols', fr: 'Contrats et protocoles' },
  platform: { en: 'Platforms', fr: 'Plateformes' },
  cloud: { en: 'Cloud', fr: 'Nuage' },
  networking: { en: 'Networking & edge', fr: 'Réseau et périphérie' },
  identity: { en: 'Identity & access', fr: 'Identité et accès' },
  os: { en: 'Operating systems', fr: 'Systèmes d’exploitation' },
  iac: { en: 'Infrastructure as code', fr: 'Infrastructure en code' },
  'ci-cd': { en: 'CI/CD', fr: 'CI/CD' },
  testing: { en: 'Testing', fr: 'Tests' },
  development: { en: 'Development tools', fr: 'Outils de développement' },
  tooling: { en: 'Tooling', fr: 'Outils' },
  observability: { en: 'Observability', fr: 'Observabilité' },
  security: { en: 'Security', fr: 'Sécurité' },
  ai: { en: 'AI', fr: 'IA' },
};

/** The catalog slug of a technology (seeded entries carry it as their first tag). */
export const slugOf = (t: Pick<Technology, 'tags' | 'name'>) => t.tags[0] ?? t.name.toLowerCase();

/** Preferred version: latest LTS when requested (falling back to latest), otherwise latest. */
export function preferredVersion(t: Pick<Technology, 'versions' | 'version'>, ltsOnly: boolean) {
  const lts = t.versions.filter((v) => v.lts);
  if (ltsOnly && lts.length) return (lts.find((v) => v.latest) ?? lts[0]).version;
  return (t.versions.find((v) => v.latest) ?? t.versions[0])?.version ?? t.version;
}

// Option values (English labels of the structured questions) implied by catalog slugs.
const implied: Record<string, Record<string, string>> = {
  'data.10': {
    rest: 'Synchronous REST over HTTP',
    graphql: 'GraphQL',
    grpc: 'gRPC',
    websockets: 'WebSockets',
    kafka: 'Event streaming',
    rabbitmq: 'Asynchronous message queue',
    mqtt: 'MQTT',
  },
  'data.11': {
    openapi: 'OpenAPI',
    asyncapi: 'AsyncAPI',
    'json-schema': 'JSON Schema',
    protobuf: 'Protocol Buffers',
    grpc: 'Protocol Buffers',
    graphql: 'GraphQL SDL',
    xml: 'XML Schema (XSD)',
  },
  'data.12': { json: 'JSON', 'json-schema': 'JSON', xml: 'XML', yaml: 'YAML', protobuf: 'Protocol Buffers', grpc: 'Protocol Buffers' },
  'delivery.9': {
    kubernetes: 'Kubernetes',
    vmware: 'Virtual machines',
    proxmox: 'Virtual machines',
    ubuntu: 'Virtual machines',
    'windows-server': 'Virtual machines',
    electron: 'Desktop installer',
    tauri: 'Desktop installer',
    android: 'Mobile app stores',
    ios: 'Mobile app stores',
  },
  'delivery.10': {
    aws: 'Amazon Web Services',
    azure: 'Microsoft Azure',
    gcp: 'Google Cloud',
    ovhcloud: 'OVHcloud',
    hetzner: 'Hetzner',
    vmware: 'VMware vSphere (on-premises)',
    proxmox: 'Proxmox VE (on-premises)',
  },
  'delivery.14': { ubuntu: 'Ubuntu LTS', debian: 'Debian stable', rhel: 'Red Hat Enterprise Linux', 'windows-server': 'Windows Server' },
  'delivery.15': {
    terraform: 'Terraform',
    opentofu: 'OpenTofu',
    terragrunt: 'Terragrunt',
    pulumi: 'Pulumi',
    cloudformation: 'AWS CloudFormation',
    'aws-cdk': 'AWS CDK',
    bicep: 'Azure Bicep',
    ansible: 'Ansible',
    helm: 'Helm',
    kustomize: 'Kustomize',
    crossplane: 'Crossplane',
  },
  'delivery.19': { opa: 'Open Policy Agent / Conftest', checkov: 'Checkov', trivy: 'Trivy (configuration scan)', kyverno: 'Kyverno' },
};
/** Technologies that define infrastructure as code; any of them answers delivery.13 with “yes”. */
export const iacSlugs = new Set(Object.keys(implied['delivery.15']));
const cicdChoice: Record<string, string> = {
  'github-actions': 'GitHub Actions',
  'gitlab-ci': 'GitLab CI/CD',
  'azure-pipelines': 'Azure Pipelines',
  jenkins: 'Jenkins',
};

/**
 * Suggested answers for unanswered structured questions, derived from the stack. Applied only
 * when the author asks, as an ordinary edit.
 */
export function stackAnswerSuggestions(spec: Spec, catalog: Technology[], lang: 'en' | 'fr'): SpecPatch {
  const chosen = spec.stack
    .map((e) => ({ entry: e, tech: catalog.find((t) => t.id === e.technologyId) }))
    .filter((x): x is { entry: StackEntry; tech: Technology } => !!x.tech);
  const slugs = new Set(chosen.map((x) => slugOf(x.tech)));
  const sections = new Map<string, Record<string, { value: string; state: 'answered'; reason: string }>>();
  const answer = (questionId: string, value: string) => {
    const moduleId = questionId.split('.')[0];
    const existing = spec.sections.find((s) => s.id === moduleId)?.answers[questionId];
    if (existing && (existing.value.trim() || existing.state !== 'answered')) return;
    sections.set(moduleId, { ...(sections.get(moduleId) ?? {}), [questionId]: { value, state: 'answered', reason: '' } });
  };
  if (chosen.length)
    answer(
      'technology.1',
      JSON.stringify(
        chosen.map(({ entry, tech }) => [tech.name, entry.version, layerInfo[entry.layer].label[lang], tech.ring]),
      ),
    );
  for (const [questionId, map] of Object.entries(implied)) {
    const values = [...new Set([...slugs].map((s) => map[s]).filter(Boolean))];
    if (values.length) answer(questionId, JSON.stringify(values));
  }
  const cicd = [...slugs].map((s) => cicdChoice[s]).find(Boolean);
  if (cicd) answer('delivery.11', cicd);
  if ([...slugs].some((s) => iacSlugs.has(s))) answer('delivery.13', 'yes');
  const languages = languagesForStack(slugs);
  if (languages.length) {
    answer('conventions.1', namingMarkdown(languages, lang));
    answer('conventions.2', layoutMarkdown(languages, lang));
  }
  return sections.size ? { sections: [...sections].map(([id, answers]) => ({ id, answers })) } : {};
}

type Rule = {
  id: string;
  when: string[];
  moduleId: string;
  kind: CustomQuestion['kind'];
  label: Localized;
  prompt: Localized;
  explain: Localized;
  options?: Localized[];
};
const L = (en: string, fr: string): Localized => ({ en, fr });
export const stackRules: Rule[] = [
  { id: 'rendering-mode', when: ['react', 'nextjs', 'vue', 'svelte', 'angular'], moduleId: 'architecture', kind: 'choice', label: L('Rendering mode', 'Mode de rendu'), prompt: L('How are pages rendered?', 'Comment les pages sont-elles rendues ?'), explain: L('Client-side apps are simple to host; server rendering improves first load and SEO; static generation suits content that rarely changes.', 'Le rendu client est simple à héberger ; le rendu serveur améliore le premier affichage et le référencement ; la génération statique convient au contenu stable.'), options: [L('Client-side single-page app', 'Application monopage côté client'), L('Server-side rendering', 'Rendu côté serveur'), L('Static generation', 'Génération statique'), L('Hybrid', 'Hybride')] },
  { id: 'client-state', when: ['react', 'angular', 'vue', 'svelte', 'nextjs', 'flutter', 'react-native'], moduleId: 'design', kind: 'text', label: L('Client state management', 'Gestion de l’état client'), prompt: L('How is client-side state managed and cached?', 'Comment l’état côté client est-il géré et mis en cache ?'), explain: L('Separate server data (cached queries) from local UI state; avoid global stores for data that belongs to the server.', 'Séparez les données serveur (requêtes en cache) de l’état local ; évitez les magasins globaux pour les données qui appartiennent au serveur.') },
  { id: 'angular-structure', when: ['angular'], moduleId: 'conventions', kind: 'choice', label: L('Angular application structure', 'Structure de l’application Angular'), prompt: L('Does the app use standalone components or NgModules?', 'L’application utilise-t-elle des composants autonomes ou des NgModules ?'), explain: L('Standalone components are the default in current Angular versions and simplify lazy loading.', 'Les composants autonomes sont la norme dans les versions actuelles d’Angular et simplifient le chargement différé.'), options: [L('Standalone components', 'Composants autonomes'), L('NgModules', 'NgModules'), L('Mixed during migration', 'Mixte pendant la migration')] },
  { id: 'django-admin', when: ['django'], moduleId: 'architecture', kind: 'switch', label: L('Django admin', 'Administration Django'), prompt: L('Will staff use the Django admin in production?', 'Le personnel utilisera-t-il l’administration Django en production ?'), explain: L('The admin is powerful but must be restricted to trusted staff, protected by MFA and audited.', 'L’administration est puissante mais doit être réservée au personnel de confiance, protégée par MFA et auditée.') },
  { id: 'python-async', when: ['fastapi'], moduleId: 'data', kind: 'switch', label: L('Async endpoints', 'Points d’accès asynchrones'), prompt: L('Are endpoints and database drivers fully asynchronous?', 'Les points d’accès et pilotes de base de données sont-ils entièrement asynchrones ?'), explain: L('Mixing blocking database calls into async endpoints stalls the event loop; pick one model per service.', 'Mélanger des appels bloquants dans des points d’accès asynchrones bloque la boucle d’événements ; choisissez un modèle par service.') },
  { id: 'python-typing', when: ['python', 'fastapi', 'django', 'flask'], moduleId: 'conventions', kind: 'choice', label: L('Python type checking', 'Vérification des types Python'), prompt: L('Which type checker runs in CI?', 'Quel vérificateur de types s’exécute en CI ?'), explain: L('Type hints plus a checker in CI catch many defects before tests run.', 'Les annotations de types et un vérificateur en CI détectent beaucoup de défauts avant les tests.'), options: [L('mypy', 'mypy'), L('pyright', 'pyright'), L('None yet', 'Aucun pour l’instant')] },
  { id: 'jvm-build', when: ['java', 'kotlin', 'spring-boot'], moduleId: 'conventions', kind: 'choice', label: L('JVM build tool', 'Outil de build JVM'), prompt: L('Which build tool builds the project?', 'Quel outil construit le projet ?'), explain: L('Use one build tool across services and pin its version with the wrapper.', 'Utilisez un seul outil entre les services et figez sa version avec le wrapper.'), options: [L('Gradle', 'Gradle'), L('Maven', 'Maven')] },
  { id: 'android-min', when: ['android', 'jetpack-compose', 'android-studio'], moduleId: 'quality', kind: 'text', label: L('Minimum Android version', 'Version Android minimale'), prompt: L('What is the minimum supported Android version (API level)?', 'Quelle est la version Android minimale prise en charge (niveau d’API) ?'), explain: L('A higher minimum simplifies development; a lower one reaches more devices. Check your audience’s device data.', 'Un minimum élevé simplifie le développement ; un minimum bas atteint plus d’appareils. Vérifiez les appareils de votre public.') },
  { id: 'play-track', when: ['android', 'jetpack-compose'], moduleId: 'delivery', kind: 'choice', label: L('Google Play release track', 'Piste de publication Google Play'), prompt: L('How do releases reach users?', 'Comment les versions atteignent-elles les utilisateurs ?'), explain: L('Staged rollouts limit the impact of a bad release.', 'Les déploiements progressifs limitent l’impact d’une mauvaise version.'), options: [L('Internal testing first', 'Test interne d’abord'), L('Closed testing', 'Test fermé'), L('Staged production rollout', 'Déploiement progressif en production')] },
  { id: 'ios-min', when: ['ios', 'swiftui', 'swift'], moduleId: 'quality', kind: 'text', label: L('Minimum iOS version', 'Version iOS minimale'), prompt: L('What is the minimum supported iOS version?', 'Quelle est la version iOS minimale prise en charge ?'), explain: L('Apple users update quickly; supporting the current and previous major versions is common.', 'Les utilisateurs Apple mettent à jour rapidement ; prendre en charge la version courante et la précédente est courant.') },
  { id: 'dotnet-nullable', when: ['csharp', 'dotnet', 'aspnet-core', 'maui', 'wpf', 'blazor'], moduleId: 'conventions', kind: 'switch', label: L('Nullable reference types', 'Types référence nullables'), prompt: L('Are nullable reference types enabled and warnings treated as errors?', 'Les types référence nullables sont-ils activés, avertissements traités comme erreurs ?'), explain: L('Nullable analysis prevents most null reference exceptions at compile time.', 'L’analyse de nullabilité évite la plupart des exceptions de référence nulle à la compilation.') },
  { id: 'cpp-build', when: ['cpp', 'c', 'qt'], moduleId: 'conventions', kind: 'choice', label: L('Native build system', 'Système de build natif'), prompt: L('Which build system and package manager are used?', 'Quels système de build et gestionnaire de paquets sont utilisés ?'), explain: L('A reproducible build with pinned dependencies is essential for native code.', 'Un build reproductible avec dépendances figées est essentiel pour le code natif.'), options: [L('CMake + vcpkg', 'CMake + vcpkg'), L('CMake + Conan', 'CMake + Conan'), L('Meson', 'Meson'), L('Bazel', 'Bazel'), L('MSBuild', 'MSBuild')] },
  { id: 'cpp-memory', when: ['cpp', 'c'], moduleId: 'security', kind: 'text', label: L('Memory-safety measures', 'Mesures de sécurité mémoire'), prompt: L('Which measures reduce memory-safety defects?', 'Quelles mesures réduisent les défauts de sécurité mémoire ?'), explain: L('Sanitizers in CI, static analysis, fuzzing and safe abstractions catch most memory errors.', 'Les sanitizers en CI, l’analyse statique, le fuzzing et des abstractions sûres détectent la plupart des erreurs mémoire.') },
  { id: 'messaging-guarantee', when: ['kafka', 'rabbitmq', 'mqtt'], moduleId: 'data', kind: 'choice', label: L('Message delivery guarantee', 'Garantie de livraison des messages'), prompt: L('Which delivery guarantee do consumers rely on?', 'Sur quelle garantie de livraison les consommateurs comptent-ils ?'), explain: L('At-least-once delivery with idempotent consumers is the usual, robust choice.', 'La livraison au moins une fois avec des consommateurs idempotents est le choix robuste habituel.'), options: [L('At most once', 'Au plus une fois'), L('At least once with idempotent consumers', 'Au moins une fois avec consommateurs idempotents'), L('Effectively once (transactions)', 'Effectivement une fois (transactions)')] },
  { id: 'dead-letter', when: ['kafka', 'rabbitmq'], moduleId: 'operations', kind: 'switch', label: L('Dead-letter handling', 'Gestion des messages en échec'), prompt: L('Do failed messages go to a monitored dead-letter queue?', 'Les messages en échec vont-ils dans une file de rebut surveillée ?'), explain: L('Without a dead-letter queue, poison messages block consumers or disappear silently.', 'Sans file de rebut, les messages empoisonnés bloquent les consommateurs ou disparaissent en silence.') },
  { id: 'proto-compat', when: ['grpc', 'protobuf'], moduleId: 'data', kind: 'text', label: L('Protobuf compatibility checks', 'Vérification de compatibilité Protobuf'), prompt: L('How are breaking .proto changes detected?', 'Comment les changements incompatibles des .proto sont-ils détectés ?'), explain: L('Run a breaking-change check (for example buf breaking) in CI against the main branch.', 'Exécutez une vérification de rupture (par exemple buf breaking) en CI contre la branche principale.') },
  { id: 'k8s-packaging', when: ['kubernetes', 'helm'], moduleId: 'delivery', kind: 'choice', label: L('Kubernetes packaging', 'Empaquetage Kubernetes'), prompt: L('How are Kubernetes resources packaged and deployed?', 'Comment les ressources Kubernetes sont-elles empaquetées et déployées ?'), explain: L('Pick one packaging approach and deploy it through the pipeline or GitOps, never by hand.', 'Choisissez une approche et déployez-la par le pipeline ou GitOps, jamais à la main.'), options: [L('Helm charts', 'Charts Helm'), L('Kustomize', 'Kustomize'), L('Plain manifests', 'Manifestes simples'), L('GitOps (Argo CD / Flux)', 'GitOps (Argo CD / Flux)')] },
  { id: 'iac-modules', when: ['terraform', 'opentofu', 'terragrunt', 'pulumi', 'aws-cdk', 'bicep'], moduleId: 'delivery', kind: 'text', label: L('Infrastructure modules and versions', 'Modules d’infrastructure et versions'), prompt: L('How are infrastructure modules shared, versioned and pinned?', 'Comment les modules d’infrastructure sont-ils partagés, versionnés et figés ?'), explain: L('Pin provider and module versions, publish shared modules with semantic versions, and commit the lock file so every plan is reproducible.', 'Figez les versions des fournisseurs et modules, publiez les modules partagés avec des versions sémantiques et versionnez le fichier de verrouillage pour des plans reproductibles.') },
  { id: 'iac-secrets', when: ['terraform', 'opentofu', 'terragrunt', 'pulumi', 'ansible', 'cloudformation', 'aws-cdk', 'bicep', 'crossplane'], moduleId: 'security', kind: 'choice', label: L('Secrets in infrastructure code', 'Secrets dans le code d’infrastructure'), prompt: L('Where do infrastructure code and pipelines read secrets from?', 'D’où le code d’infrastructure et les pipelines lisent-ils les secrets ?'), explain: L('Secrets must never be committed or stored in plain state files; read them from a vault at apply time and mark outputs as sensitive.', 'Les secrets ne doivent jamais être versionnés ni stockés en clair dans l’état ; lisez-les depuis un coffre au moment de l’application et marquez les sorties comme sensibles.'), options: [L('Cloud secret manager', 'Gestionnaire de secrets infonuagique'), L('HashiCorp Vault / OpenBao', 'HashiCorp Vault / OpenBao'), L('Pipeline secret store (OIDC federation)', 'Coffre du pipeline (fédération OIDC)'), L('Encrypted files (SOPS / Ansible Vault)', 'Fichiers chiffrés (SOPS / Ansible Vault)')] },
  { id: 'image-base', when: ['docker', 'kubernetes'], moduleId: 'delivery', kind: 'text', label: L('Container base images', 'Images de base des conteneurs'), prompt: L('Which base images are used, and how are they kept patched?', 'Quelles images de base sont utilisées, et comment restent-elles à jour ?'), explain: L('Small, pinned base images with automated rebuilds reduce vulnerabilities.', 'Des images de base réduites, figées et reconstruites automatiquement réduisent les vulnérabilités.') },
  { id: 'db-migrations', when: ['postgresql', 'mysql', 'sqlserver'], moduleId: 'data', kind: 'choice', label: L('Database migration tool', 'Outil de migration de base de données'), prompt: L('Which tool applies schema migrations?', 'Quel outil applique les migrations de schéma ?'), explain: L('Migrations must be versioned, reviewed and run by the pipeline.', 'Les migrations doivent être versionnées, revues et exécutées par le pipeline.'), options: [L('Framework migrations', 'Migrations du framework'), L('Flyway', 'Flyway'), L('Liquibase', 'Liquibase'), L('Entity Framework Core', 'Entity Framework Core'), L('Alembic', 'Alembic')] },
  { id: 'mongo-schema', when: ['mongodb'], moduleId: 'data', kind: 'text', label: L('Document schema validation', 'Validation du schéma des documents'), prompt: L('How are document shapes validated?', 'Comment la forme des documents est-elle validée ?'), explain: L('Validate in the application with shared schemas, and optionally with collection-level $jsonSchema rules.', 'Validez dans l’application avec des schémas partagés, et éventuellement avec des règles $jsonSchema de collection.') },
  { id: 'branch-protection', when: ['github-actions', 'gitlab-ci', 'azure-pipelines'], moduleId: 'delivery', kind: 'switch', label: L('Protected main branch', 'Branche principale protégée'), prompt: L('Is the main branch protected with required reviews and checks?', 'La branche principale est-elle protégée par des revues et vérifications obligatoires ?'), explain: L('Protection prevents unreviewed or failing changes from reaching the release branch.', 'La protection empêche les changements non revus ou en échec d’atteindre la branche de livraison.') },
  { id: 'ai-data', when: ['claude', 'openai', 'ollama'], moduleId: 'security', kind: 'switch', label: L('Customer data in AI prompts', 'Données clients dans les requêtes IA'), prompt: L('May prompts sent to AI services contain customer data?', 'Les requêtes envoyées aux services d’IA peuvent-elles contenir des données clients ?'), explain: L('If yes, confirm contractual terms, retention and region with the provider — or use a local model.', 'Si oui, confirmez les conditions contractuelles, la conservation et la région avec le fournisseur — ou utilisez un modèle local.') },
  { id: 'desktop-updates', when: ['electron', 'tauri', 'qt', 'wpf', 'winui', 'maui'], moduleId: 'delivery', kind: 'text', label: L('Desktop update channel', 'Canal de mise à jour bureau'), prompt: L('How are desktop updates signed, delivered and rolled back?', 'Comment les mises à jour bureau sont-elles signées, livrées et annulées ?'), explain: L('Signed installers and an update channel with staged rollout protect users from tampered or broken builds.', 'Des installateurs signés et un canal progressif protègent contre les versions altérées ou défectueuses.') },
  { id: 'cross-platform', when: ['flutter', 'react-native', 'maui'], moduleId: 'quality', kind: 'text', label: L('Platform differences', 'Différences entre plateformes'), prompt: L('Which behaviours differ between platforms, and how are they tested?', 'Quels comportements diffèrent entre plateformes, et comment sont-ils testés ?'), explain: L('Permissions, background work, notifications and navigation often differ; test each on real devices.', 'Permissions, tâches de fond, notifications et navigation diffèrent souvent ; testez-les sur de vrais appareils.') },
];

/** Rule-generated questions for the stack that the project does not have yet. */
export function stackQuestions(spec: Pick<Spec, 'stack' | 'customQuestions'>, catalog: Technology[]): CustomQuestion[] {
  const slugs = new Set(
    spec.stack.map((e) => catalog.find((t) => t.id === e.technologyId)).filter((t): t is Technology => !!t).map(slugOf),
  );
  return stackRules
    .filter((r) => r.when.some((w) => slugs.has(w)))
    .map((r) => ({
      id: `${r.moduleId}.c-${r.id}`,
      moduleId: r.moduleId,
      label: r.label,
      prompt: r.prompt,
      explain: r.explain,
      kind: r.kind,
      ...(r.options ? { options: r.options } : {}),
      required: false,
      origin: 'rule' as const,
      rule: `stack:${r.id}`,
    }))
    .filter((q) => !spec.customQuestions.some((c) => c.id === q.id));
}
