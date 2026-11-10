import { createHash } from 'node:crypto';
import type { StackLayer, Technology, TechnologyVersion } from '../../../packages/shared/src/schema';

/**
 * Starter technology catalog. Versions and support notes reflect what was known in mid-2026 and
 * only list releases the authors were confident about; every entry links to its official site and,
 * where available, endoflife.date so reviewers can confirm dates. Seeded entries are inserted once
 * and never overwrite a team's edits.
 */
export const seedVerifiedAt = '2026-06';

/** Stable UUID (v5 layout) derived from the slug, so reseeding never duplicates entries. */
export function seedId(slug: string) {
  const h = createHash('sha1').update(`sdd-studio:technology:${slug}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
type V = [version: string, flags?: string, support?: string];
const versions = (list: V[]): TechnologyVersion[] =>
  list.map(([version, flags = '', support = '']) => ({
    version,
    lts: flags.includes('lts'),
    latest: flags.includes('latest'),
    support,
  }));

type Entry = {
  slug: string;
  name: string;
  category: Technology['category'];
  quadrant: Technology['quadrant'];
  layers: StackLayer[];
  ring?: Technology['ring'];
  license?: string;
  icon?: string;
  url: string;
  eol?: string;
  tags?: string[];
  alternatives?: string[];
  rationale?: string;
  versions: V[];
};

const entries: Entry[] = [
  // Languages
  { slug: 'typescript', name: 'TypeScript', category: 'language', quadrant: 'Languages & Frameworks', layers: ['frontend', 'backend', 'desktop', 'mobile'], ring: 'Adopt', license: 'Apache-2.0', icon: 'typescript', url: 'https://www.typescriptlang.org/', tags: ['web', 'node'], versions: [['5.9', 'latest', 'Current'], ['5.8']] },
  { slug: 'javascript', name: 'JavaScript (ECMAScript)', category: 'language', quadrant: 'Languages & Frameworks', layers: ['frontend', 'backend'], license: 'Standard', icon: 'javascript', url: 'https://tc39.es/ecma262/', tags: ['web'], versions: [['ES2025', 'latest', 'Published June 2025'], ['ES2024']] },
  { slug: 'python', name: 'Python', category: 'language', quadrant: 'Languages & Frameworks', layers: ['backend', 'ai', 'data'], ring: 'Adopt', license: 'PSF-2.0', icon: 'python', url: 'https://www.python.org/', eol: 'python', tags: ['data', 'ai', 'scripting'], versions: [['3.14', 'latest', 'Bugfix'], ['3.13', '', 'Bugfix'], ['3.12', '', 'Security fixes'], ['3.11', '', 'Security fixes'], ['3.10', '', 'Security fixes until October 2026']] },
  { slug: 'java', name: 'Java (OpenJDK)', category: 'language', quadrant: 'Languages & Frameworks', layers: ['backend', 'mobile', 'desktop'], ring: 'Adopt', license: 'GPL-2.0-with-classpath-exception', icon: 'openjdk', url: 'https://openjdk.org/', eol: 'eclipse-temurin', tags: ['jvm'], versions: [['26', 'latest', 'Feature release (March 2026)'], ['25', 'lts', 'LTS (September 2025)'], ['21', 'lts', 'LTS'], ['17', 'lts', 'LTS'], ['11', 'lts', 'LTS, extended support by vendors'], ['8', 'lts', 'LTS, extended support by vendors']] },
  { slug: 'kotlin', name: 'Kotlin', category: 'language', quadrant: 'Languages & Frameworks', layers: ['mobile', 'backend', 'desktop'], ring: 'Adopt', license: 'Apache-2.0', icon: 'kotlin', url: 'https://kotlinlang.org/', tags: ['jvm', 'android'], versions: [['2.3', 'latest'], ['2.2'], ['2.1']] },
  { slug: 'csharp', name: 'C#', category: 'language', quadrant: 'Languages & Frameworks', layers: ['backend', 'desktop', 'mobile'], ring: 'Adopt', license: 'MIT', icon: '', url: 'https://learn.microsoft.com/dotnet/csharp/', tags: ['dotnet'], versions: [['14', 'latest lts', 'Ships with .NET 10 LTS'], ['13', '', '.NET 9'], ['12', 'lts', '.NET 8 LTS']] },
  { slug: 'cpp', name: 'C++', category: 'language', quadrant: 'Languages & Frameworks', layers: ['desktop', 'backend', 'mobile'], license: 'ISO standard', icon: 'cplusplus', url: 'https://isocpp.org/', tags: ['native', 'embedded'], versions: [['C++23', 'latest', 'Latest published ISO standard'], ['C++20'], ['C++17']] },
  { slug: 'c', name: 'C', category: 'language', quadrant: 'Languages & Frameworks', layers: ['desktop', 'backend'], license: 'ISO standard', icon: 'c', url: 'https://www.iso.org/standard/82075.html', tags: ['native', 'embedded'], versions: [['C23', 'latest'], ['C17']] },
  { slug: 'go', name: 'Go', category: 'language', quadrant: 'Languages & Frameworks', layers: ['backend'], license: 'BSD-3-Clause', icon: 'go', url: 'https://go.dev/', eol: 'go', tags: ['cloud-native'], versions: [['1.26', 'latest', 'Supported'], ['1.25', '', 'Supported']] },
  { slug: 'rust', name: 'Rust', category: 'language', quadrant: 'Languages & Frameworks', layers: ['backend', 'desktop'], ring: 'Trial', license: 'MIT OR Apache-2.0', icon: 'rust', url: 'https://www.rust-lang.org/', tags: ['native', 'memory-safe'], versions: [['stable', 'latest', 'Six-week release train']] },
  { slug: 'swift', name: 'Swift', category: 'language', quadrant: 'Languages & Frameworks', layers: ['mobile', 'desktop'], license: 'Apache-2.0', icon: 'swift', url: 'https://www.swift.org/', tags: ['ios', 'apple'], versions: [['6.2', 'latest'], ['6.1'], ['5.10']] },
  { slug: 'dart', name: 'Dart', category: 'language', quadrant: 'Languages & Frameworks', layers: ['mobile', 'frontend'], license: 'BSD-3-Clause', icon: 'dart', url: 'https://dart.dev/', versions: [['3.x', 'latest']] },
  // Runtimes and platforms
  { slug: 'nodejs', name: 'Node.js', category: 'runtime', quadrant: 'Platforms', layers: ['backend'], ring: 'Adopt', license: 'MIT', icon: 'nodedotjs', url: 'https://nodejs.org/', eol: 'nodejs', versions: [['26', 'latest', 'Current; becomes LTS in October 2026'], ['24', 'lts', 'Active LTS'], ['22', 'lts', 'Maintenance LTS'], ['20', 'lts', 'End of life April 2026']] },
  { slug: 'dotnet', name: '.NET', category: 'runtime', quadrant: 'Platforms', layers: ['backend', 'desktop', 'mobile'], ring: 'Adopt', license: 'MIT', icon: 'dotnet', url: 'https://dotnet.microsoft.com/', eol: 'dotnet', versions: [['10', 'latest lts', 'LTS (November 2025)'], ['9', '', 'STS'], ['8', 'lts', 'LTS until November 2026']] },
  { slug: 'deno', name: 'Deno', category: 'runtime', quadrant: 'Platforms', layers: ['backend'], ring: 'Assess', license: 'MIT', icon: 'deno', url: 'https://deno.com/', versions: [['2.x', 'latest']] },
  { slug: 'android', name: 'Android', category: 'platform', quadrant: 'Platforms', layers: ['mobile'], license: 'Apache-2.0', icon: 'android', url: 'https://developer.android.com/', eol: 'android', tags: ['mobile'], versions: [['16 (API 36)', 'latest'], ['15 (API 35)'], ['14 (API 34)']] },
  { slug: 'android-studio', name: 'Android Studio', category: 'development', quadrant: 'Tools', layers: ['mobile', 'development'], ring: 'Adopt', license: 'Apache-2.0', icon: 'androidstudio', url: 'https://developer.android.com/studio', tags: ['ide', 'android'], versions: [['Stable channel', 'latest', 'Quarterly feature drops']] },
  { slug: 'ios', name: 'iOS / iPadOS', category: 'platform', quadrant: 'Platforms', layers: ['mobile'], license: 'Proprietary', icon: 'ios', url: 'https://developer.apple.com/ios/', versions: [['26', 'latest'], ['18']] },
  // Frontend frameworks
  { slug: 'react', name: 'React', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend'], ring: 'Adopt', license: 'MIT', icon: 'react', url: 'https://react.dev/', eol: 'react', tags: ['web', 'spa'], alternatives: ['Angular', 'Vue', 'Svelte'], versions: [['19', 'latest'], ['18']] },
  { slug: 'angular', name: 'Angular', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend'], ring: 'Adopt', license: 'MIT', icon: 'angular', url: 'https://angular.dev/', eol: 'angular', tags: ['web', 'spa'], alternatives: ['React', 'Vue'], versions: [['21', 'latest', 'Active'], ['20', 'lts', 'LTS'], ['19', 'lts', 'LTS ended May 2026']] },
  { slug: 'vue', name: 'Vue.js', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend'], ring: 'Trial', license: 'MIT', icon: 'vuedotjs', url: 'https://vuejs.org/', eol: 'vue', versions: [['3.5', 'latest']] },
  { slug: 'svelte', name: 'Svelte', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend'], ring: 'Assess', license: 'MIT', icon: 'svelte', url: 'https://svelte.dev/', versions: [['5', 'latest']] },
  { slug: 'nextjs', name: 'Next.js', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend', 'backend'], ring: 'Trial', license: 'MIT', icon: 'nextdotjs', url: 'https://nextjs.org/', eol: 'nextjs', versions: [['16', 'latest'], ['15']] },
  { slug: 'blazor', name: 'Blazor', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['frontend'], license: 'MIT', icon: 'blazor', url: 'https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor', versions: [['.NET 10', 'latest lts'], ['.NET 8', 'lts']] },
  { slug: 'tailwind', name: 'Tailwind CSS', category: 'library', quadrant: 'Tools', layers: ['frontend'], license: 'MIT', icon: 'tailwindcss', url: 'https://tailwindcss.com/', versions: [['4', 'latest'], ['3']] },
  { slug: 'shadcn', name: 'shadcn/ui', category: 'library', quadrant: 'Tools', layers: ['frontend'], ring: 'Adopt', license: 'MIT', icon: 'shadcnui', url: 'https://ui.shadcn.com/', versions: [['latest', 'latest', 'Copied components, versioned in your repository']] },
  // Backend frameworks
  { slug: 'fastapi', name: 'FastAPI', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], ring: 'Adopt', license: 'MIT', icon: 'fastapi', url: 'https://fastapi.tiangolo.com/', tags: ['python', 'openapi'], alternatives: ['Django', 'Flask'], versions: [['0.x', 'latest', 'Pre-1.0; pin minor versions']] },
  { slug: 'django', name: 'Django', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend', 'frontend'], ring: 'Adopt', license: 'BSD-3-Clause', icon: 'django', url: 'https://www.djangoproject.com/', eol: 'django', tags: ['python'], alternatives: ['FastAPI'], versions: [['6.0', 'latest'], ['5.2', 'lts', 'LTS'], ['4.2', 'lts', 'LTS ended April 2026']] },
  { slug: 'flask', name: 'Flask', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], license: 'BSD-3-Clause', icon: 'flask', url: 'https://flask.palletsprojects.com/', versions: [['3.1', 'latest']] },
  { slug: 'aspnet-core', name: 'ASP.NET Core', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], ring: 'Adopt', license: 'MIT', icon: 'dotnet', url: 'https://dotnet.microsoft.com/apps/aspnet', eol: 'dotnet', tags: ['dotnet'], versions: [['10', 'latest lts', 'LTS'], ['8', 'lts', 'LTS until November 2026']] },
  { slug: 'spring-boot', name: 'Spring Boot', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], ring: 'Adopt', license: 'Apache-2.0', icon: 'springboot', url: 'https://spring.io/projects/spring-boot', eol: 'spring-boot', tags: ['java', 'kotlin'], versions: [['4.0', 'latest'], ['3.5']] },
  { slug: 'nestjs', name: 'NestJS', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], license: 'MIT', icon: 'nestjs', url: 'https://nestjs.com/', versions: [['11', 'latest']] },
  { slug: 'fastify', name: 'Fastify', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], ring: 'Adopt', license: 'MIT', icon: 'fastify', url: 'https://fastify.dev/', versions: [['5', 'latest'], ['4', '', 'End of life']] },
  { slug: 'express', name: 'Express', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['backend'], license: 'MIT', icon: 'express', url: 'https://expressjs.com/', versions: [['5', 'latest'], ['4', '', 'Maintenance']] },
  // Mobile and desktop
  { slug: 'jetpack-compose', name: 'Jetpack Compose', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['mobile'], ring: 'Adopt', license: 'Apache-2.0', icon: 'jetpackcompose', url: 'https://developer.android.com/compose', tags: ['android', 'kotlin'], versions: [['BOM latest', 'latest']] },
  { slug: 'swiftui', name: 'SwiftUI', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['mobile', 'desktop'], license: 'Proprietary', icon: 'swift', url: 'https://developer.apple.com/xcode/swiftui/', versions: [['iOS 26 SDK', 'latest']] },
  { slug: 'flutter', name: 'Flutter', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['mobile', 'desktop', 'frontend'], ring: 'Trial', license: 'BSD-3-Clause', icon: 'flutter', url: 'https://flutter.dev/', versions: [['3.x', 'latest', 'Quarterly stable releases']] },
  { slug: 'react-native', name: 'React Native', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['mobile'], ring: 'Trial', license: 'MIT', icon: 'react', url: 'https://reactnative.dev/', versions: [['0.8x', 'latest', 'New architecture by default']] },
  { slug: 'maui', name: '.NET MAUI', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['mobile', 'desktop'], license: 'MIT', icon: 'dotnet', url: 'https://dotnet.microsoft.com/apps/maui', versions: [['10', 'latest lts'], ['9']] },
  { slug: 'electron', name: 'Electron', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['desktop'], license: 'MIT', icon: 'electron', url: 'https://www.electronjs.org/', eol: 'electron', versions: [['Latest stable', 'latest', 'Latest three majors supported']] },
  { slug: 'tauri', name: 'Tauri', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['desktop', 'mobile'], ring: 'Assess', license: 'MIT OR Apache-2.0', icon: 'tauri', url: 'https://tauri.app/', versions: [['2', 'latest']] },
  { slug: 'qt', name: 'Qt', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['desktop', 'mobile'], license: 'LGPL-3.0 or commercial', icon: 'qt', url: 'https://www.qt.io/', eol: 'qt', versions: [['6.10', 'latest'], ['6.8', 'lts', 'LTS']] },
  { slug: 'winui', name: 'WinUI 3 / Windows App SDK', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['desktop'], license: 'MIT', icon: '', url: 'https://learn.microsoft.com/windows/apps/winui/', versions: [['1.8', 'latest']] },
  { slug: 'wpf', name: 'WPF', category: 'framework', quadrant: 'Languages & Frameworks', layers: ['desktop'], license: 'MIT', icon: 'dotnet', url: 'https://learn.microsoft.com/dotnet/desktop/wpf/', versions: [['.NET 10', 'latest lts'], ['.NET 8', 'lts']] },
  // Data
  { slug: 'postgresql', name: 'PostgreSQL', category: 'database', quadrant: 'Platforms', layers: ['data'], ring: 'Adopt', license: 'PostgreSQL', icon: 'postgresql', url: 'https://www.postgresql.org/', eol: 'postgresql', versions: [['18', 'latest'], ['17'], ['16'], ['15'], ['14', '', 'Supported until November 2026']] },
  { slug: 'mysql', name: 'MySQL', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'GPL-2.0', icon: 'mysql', url: 'https://www.mysql.com/', eol: 'mysql', versions: [['9.x', 'latest', 'Innovation releases'], ['8.4', 'lts', 'LTS'], ['8.0', '', 'End of life April 2026']] },
  { slug: 'sqlserver', name: 'Microsoft SQL Server', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', icon: '', url: 'https://www.microsoft.com/sql-server', eol: 'mssqlserver', versions: [['2025', 'latest'], ['2022']] },
  { slug: 'mongodb', name: 'MongoDB', category: 'database', quadrant: 'Platforms', layers: ['data'], ring: 'Adopt', license: 'SSPL-1.0', icon: 'mongodb', url: 'https://www.mongodb.com/', eol: 'mongodb', versions: [['8.0', 'latest', 'Major release'], ['7.0']] },
  { slug: 'redis', name: 'Redis', category: 'database', quadrant: 'Platforms', layers: ['data', 'communication'], license: 'AGPL-3.0 / RSALv2 / SSPLv1', icon: 'redis', url: 'https://redis.io/', eol: 'redis', versions: [['8.x', 'latest'], ['7.4']] },
  { slug: 'sqlite', name: 'SQLite', category: 'database', quadrant: 'Platforms', layers: ['data', 'mobile', 'desktop'], license: 'Public domain', icon: 'sqlite', url: 'https://sqlite.org/', versions: [['3.x', 'latest']] },
  { slug: 'elasticsearch', name: 'Elasticsearch', category: 'search', quadrant: 'Platforms', layers: ['data'], license: 'AGPL-3.0 / SSPL / Elastic', icon: 'elasticsearch', url: 'https://www.elastic.co/elasticsearch', versions: [['9.x', 'latest'], ['8.x']] },
  // Messaging and communication
  { slug: 'kafka', name: 'Apache Kafka', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Apache-2.0', icon: 'apachekafka', url: 'https://kafka.apache.org/', tags: ['async', 'event-streaming'], versions: [['4.1', 'latest'], ['4.0', '', 'ZooKeeper removed'], ['3.9']] },
  { slug: 'rabbitmq', name: 'RabbitMQ', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'MPL-2.0', icon: 'rabbitmq', url: 'https://www.rabbitmq.com/', tags: ['async', 'amqp'], versions: [['4.x', 'latest']] },
  { slug: 'rest', name: 'REST over HTTP', category: 'contract', quadrant: 'Techniques', layers: ['communication'], ring: 'Adopt', license: 'Standard', icon: '', url: 'https://www.rfc-editor.org/rfc/rfc9110', tags: ['sync'], versions: [['HTTP/3', ''], ['HTTP/2', 'latest', 'Widely deployed'], ['HTTP/1.1']] },
  { slug: 'grpc', name: 'gRPC', category: 'contract', quadrant: 'Techniques', layers: ['communication'], license: 'Apache-2.0', icon: '', url: 'https://grpc.io/', tags: ['sync', 'streaming'], versions: [['1.x', 'latest']] },
  { slug: 'graphql', name: 'GraphQL', category: 'contract', quadrant: 'Techniques', layers: ['communication', 'contracts'], license: 'Specification', icon: 'graphql', url: 'https://spec.graphql.org/', tags: ['sync'], versions: [['Latest specification edition', 'latest']] },
  { slug: 'websockets', name: 'WebSockets', category: 'contract', quadrant: 'Techniques', layers: ['communication'], license: 'Standard', icon: 'socketdotio', url: 'https://www.rfc-editor.org/rfc/rfc6455', tags: ['realtime'], versions: [['RFC 6455', 'latest']] },
  { slug: 'mqtt', name: 'MQTT', category: 'messaging', quadrant: 'Techniques', layers: ['communication'], license: 'OASIS standard', icon: 'mqtt', url: 'https://mqtt.org/', tags: ['iot', 'async'], versions: [['5.0', 'latest'], ['3.1.1']] },
  // Contracts and formats
  { slug: 'json', name: 'JSON', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], ring: 'Adopt', license: 'Standard', icon: 'json', url: 'https://www.rfc-editor.org/rfc/rfc8259', versions: [['RFC 8259', 'latest']] },
  { slug: 'json-schema', name: 'JSON Schema', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], ring: 'Adopt', license: 'Specification', icon: 'json', url: 'https://json-schema.org/', versions: [['2020-12', 'latest'], ['Draft 7']] },
  { slug: 'openapi', name: 'OpenAPI', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], ring: 'Adopt', license: 'Apache-2.0', icon: 'openapiinitiative', url: 'https://spec.openapis.org/oas/latest.html', versions: [['3.2', 'latest'], ['3.1'], ['3.0']] },
  { slug: 'asyncapi', name: 'AsyncAPI', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], ring: 'Trial', license: 'Apache-2.0', icon: '', url: 'https://www.asyncapi.com/', versions: [['3.0', 'latest'], ['2.6']] },
  { slug: 'protobuf', name: 'Protocol Buffers', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], license: 'BSD-3-Clause', icon: '', url: 'https://protobuf.dev/', versions: [['Editions', 'latest'], ['proto3']] },
  { slug: 'xml', name: 'XML / XSD', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], license: 'W3C standard', icon: 'xml', url: 'https://www.w3.org/XML/', versions: [['XSD 1.1', 'latest'], ['XML 1.0']] },
  { slug: 'yaml', name: 'YAML', category: 'contract', quadrant: 'Techniques', layers: ['contracts'], license: 'Specification', icon: 'yaml', url: 'https://yaml.org/', versions: [['1.2.2', 'latest']] },
  // Infrastructure, cloud and operating systems
  { slug: 'docker', name: 'Docker', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], ring: 'Adopt', license: 'Apache-2.0', icon: 'docker', url: 'https://www.docker.com/', versions: [['Engine latest', 'latest']] },
  { slug: 'kubernetes', name: 'Kubernetes', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], ring: 'Adopt', license: 'Apache-2.0', icon: 'kubernetes', url: 'https://kubernetes.io/', eol: 'kubernetes', versions: [['1.35', 'latest'], ['1.34'], ['1.33']] },
  // Infrastructure as code and policy as code
  { slug: 'helm', name: 'Helm', category: 'iac', quadrant: 'Tools', layers: ['iac', 'infrastructure', 'cicd'], license: 'Apache-2.0', icon: 'helm', url: 'https://helm.sh/', tags: ['packaging', 'kubernetes'], alternatives: ['Kustomize'], versions: [['4', 'latest'], ['3']] },
  { slug: 'terraform', name: 'Terraform', category: 'iac', quadrant: 'Tools', layers: ['iac', 'infrastructure'], ring: 'Adopt', license: 'BUSL-1.1', icon: 'terraform', url: 'https://www.terraform.io/', tags: ['provisioning'], alternatives: ['OpenTofu', 'Pulumi'], rationale: 'Business Source License since 1.6: check the usage limits before offering a competing hosted service.', versions: [['1.x', 'latest']] },
  { slug: 'opentofu', name: 'OpenTofu', category: 'iac', quadrant: 'Tools', layers: ['iac'], ring: 'Trial', license: 'MPL-2.0', icon: 'opentofu', url: 'https://opentofu.org/', tags: ['provisioning'], alternatives: ['Terraform'], rationale: 'Open-source (MPL-2.0) fork of Terraform under the Linux Foundation; compatible with Terraform 1.5 configurations.', versions: [['1.x', 'latest', 'Supported releases listed on opentofu.org']] },
  { slug: 'terragrunt', name: 'Terragrunt', category: 'iac', quadrant: 'Tools', layers: ['iac'], ring: 'Assess', license: 'MIT', icon: '', url: 'https://terragrunt.gruntwork.io/', tags: ['provisioning'], versions: [['latest', 'latest']] },
  { slug: 'pulumi', name: 'Pulumi', category: 'iac', quadrant: 'Tools', layers: ['iac'], ring: 'Trial', license: 'Apache-2.0', icon: 'pulumi', url: 'https://www.pulumi.com/', tags: ['provisioning'], alternatives: ['Terraform', 'AWS CDK'], versions: [['3.x', 'latest']] },
  { slug: 'cloudformation', name: 'AWS CloudFormation', category: 'iac', quadrant: 'Tools', layers: ['iac'], license: 'Commercial', icon: '', url: 'https://aws.amazon.com/cloudformation/', tags: ['provisioning', 'aws'], versions: [['Service-based', 'latest']] },
  { slug: 'aws-cdk', name: 'AWS CDK', category: 'iac', quadrant: 'Tools', layers: ['iac'], license: 'Apache-2.0', icon: '', url: 'https://aws.amazon.com/cdk/', tags: ['provisioning', 'aws'], versions: [['2.x', 'latest']] },
  { slug: 'bicep', name: 'Azure Bicep', category: 'iac', quadrant: 'Tools', layers: ['iac'], ring: 'Trial', license: 'MIT', icon: '', url: 'https://learn.microsoft.com/azure/azure-resource-manager/bicep/', tags: ['provisioning', 'azure'], versions: [['0.x', 'latest', 'Frequent releases']] },
  { slug: 'ansible', name: 'Ansible', category: 'iac', quadrant: 'Tools', layers: ['iac', 'infrastructure'], license: 'GPL-3.0', icon: 'ansible', url: 'https://www.ansible.com/', tags: ['configuration'], versions: [['ansible-core 2.x', 'latest']] },
  { slug: 'kustomize', name: 'Kustomize', category: 'iac', quadrant: 'Tools', layers: ['iac'], license: 'Apache-2.0', icon: '', url: 'https://kustomize.io/', tags: ['packaging', 'kubernetes'], alternatives: ['Helm'], versions: [['5.x', 'latest']] },
  { slug: 'crossplane', name: 'Crossplane', category: 'iac', quadrant: 'Tools', layers: ['iac', 'infrastructure'], ring: 'Assess', license: 'Apache-2.0', icon: '', url: 'https://www.crossplane.io/', tags: ['provisioning', 'kubernetes'], versions: [['2.x', 'latest'], ['1.x']] },
  { slug: 'opa', name: 'Open Policy Agent', category: 'security', quadrant: 'Tools', layers: ['iac', 'cicd'], ring: 'Trial', license: 'Apache-2.0', icon: '', url: 'https://www.openpolicyagent.org/', tags: ['policy-as-code'], versions: [['1.x', 'latest']] },
  { slug: 'checkov', name: 'Checkov', category: 'security', quadrant: 'Tools', layers: ['iac', 'cicd'], ring: 'Trial', license: 'Apache-2.0', icon: '', url: 'https://www.checkov.io/', tags: ['policy-as-code', 'scanner'], versions: [['3.x', 'latest']] },
  { slug: 'kyverno', name: 'Kyverno', category: 'security', quadrant: 'Tools', layers: ['iac', 'infrastructure'], license: 'Apache-2.0', icon: '', url: 'https://kyverno.io/', tags: ['policy-as-code', 'kubernetes'], versions: [['1.x', 'latest']] },
  { slug: 'nginx', name: 'NGINX', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'BSD-2-Clause', icon: 'nginx', url: 'https://nginx.org/', eol: 'nginx', versions: [['Mainline', 'latest'], ['Stable', 'lts']] },
  { slug: 'aws', name: 'Amazon Web Services', category: 'cloud', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: '', url: 'https://aws.amazon.com/', versions: [['Service-based', 'latest']] },
  { slug: 'azure', name: 'Microsoft Azure', category: 'cloud', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: '', url: 'https://azure.microsoft.com/', versions: [['Service-based', 'latest']] },
  { slug: 'gcp', name: 'Google Cloud', category: 'cloud', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'googlecloud', url: 'https://cloud.google.com/', versions: [['Service-based', 'latest']] },
  { slug: 'ovhcloud', name: 'OVHcloud', category: 'cloud', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'ovh', url: 'https://www.ovhcloud.com/', versions: [['Service-based', 'latest']] },
  { slug: 'hetzner', name: 'Hetzner Cloud', category: 'cloud', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'hetzner', url: 'https://www.hetzner.com/cloud', versions: [['Service-based', 'latest']] },
  { slug: 'vmware', name: 'VMware vSphere', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'vmware', url: 'https://www.vmware.com/products/vsphere.html', versions: [['8', 'latest']] },
  { slug: 'proxmox', name: 'Proxmox VE', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'AGPL-3.0', icon: 'proxmox', url: 'https://www.proxmox.com/', versions: [['9', 'latest'], ['8']] },
  { slug: 'ubuntu', name: 'Ubuntu Server', category: 'os', quadrant: 'Platforms', layers: ['infrastructure'], ring: 'Adopt', license: 'Various (GPL)', icon: 'ubuntu', url: 'https://ubuntu.com/server', eol: 'ubuntu', versions: [['26.04 LTS', 'latest lts', 'LTS (April 2026)'], ['24.04 LTS', 'lts', 'LTS'], ['22.04 LTS', 'lts', 'LTS']] },
  { slug: 'debian', name: 'Debian', category: 'os', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Various (GPL)', icon: 'debian', url: 'https://www.debian.org/', eol: 'debian', versions: [['13 (trixie)', 'latest', 'Stable'], ['12 (bookworm)', 'lts', 'Oldstable, then LTS']] },
  { slug: 'rhel', name: 'Red Hat Enterprise Linux', category: 'os', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'redhat', url: 'https://www.redhat.com/rhel', eol: 'rhel', versions: [['10', 'latest'], ['9', 'lts', 'Long lifecycle'], ['8', 'lts', 'Long lifecycle']] },
  { slug: 'windows-server', name: 'Windows Server', category: 'os', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: '', url: 'https://www.microsoft.com/windows-server', eol: 'windows-server', versions: [['2025', 'latest lts', 'Long-Term Servicing Channel'], ['2022', 'lts', 'LTSC']] },
  // CI/CD
  { slug: 'github-actions', name: 'GitHub Actions', category: 'ci-cd', quadrant: 'Tools', layers: ['cicd'], ring: 'Adopt', license: 'Commercial', icon: 'githubactions', url: 'https://docs.github.com/actions', versions: [['Hosted', 'latest']] },
  { slug: 'gitlab-ci', name: 'GitLab CI/CD', category: 'ci-cd', quadrant: 'Tools', layers: ['cicd'], license: 'MIT / commercial', icon: 'gitlab', url: 'https://docs.gitlab.com/ci/', versions: [['Monthly releases', 'latest']] },
  { slug: 'azure-pipelines', name: 'Azure Pipelines', category: 'ci-cd', quadrant: 'Tools', layers: ['cicd'], license: 'Commercial', icon: '', url: 'https://learn.microsoft.com/azure/devops/pipelines/', versions: [['Hosted', 'latest']] },
  { slug: 'jenkins', name: 'Jenkins', category: 'ci-cd', quadrant: 'Tools', layers: ['cicd'], ring: 'Hold', license: 'MIT', icon: 'jenkins', url: 'https://www.jenkins.io/', rationale: 'Prefer hosted pipelines for new projects; keep for existing installations.', versions: [['LTS line', 'lts'], ['Weekly', 'latest']] },
  { slug: 'argo-cd', name: 'Argo CD', category: 'ci-cd', quadrant: 'Tools', layers: ['cicd', 'infrastructure'], ring: 'Trial', license: 'Apache-2.0', icon: 'argo', url: 'https://argo-cd.readthedocs.io/', versions: [['3.x', 'latest']] },
  // Testing and quality
  { slug: 'playwright', name: 'Playwright', category: 'testing', quadrant: 'Tools', layers: ['testing'], ring: 'Adopt', license: 'Apache-2.0', icon: '', url: 'https://playwright.dev/', versions: [['1.5x', 'latest']] },
  { slug: 'vitest', name: 'Vitest', category: 'testing', quadrant: 'Tools', layers: ['testing'], ring: 'Adopt', license: 'MIT', icon: 'vitest', url: 'https://vitest.dev/', versions: [['4', 'latest'], ['3']] },
  { slug: 'jest', name: 'Jest', category: 'testing', quadrant: 'Tools', layers: ['testing'], license: 'MIT', icon: 'jest', url: 'https://jestjs.io/', versions: [['30', 'latest']] },
  { slug: 'pytest', name: 'pytest', category: 'testing', quadrant: 'Tools', layers: ['testing'], ring: 'Adopt', license: 'MIT', icon: 'pytest', url: 'https://pytest.org/', versions: [['8.x', 'latest']] },
  { slug: 'junit', name: 'JUnit', category: 'testing', quadrant: 'Tools', layers: ['testing'], license: 'EPL-2.0', icon: 'junit5', url: 'https://junit.org/', versions: [['6', 'latest'], ['5']] },
  { slug: 'xunit', name: 'xUnit.net', category: 'testing', quadrant: 'Tools', layers: ['testing'], license: 'Apache-2.0', icon: '', url: 'https://xunit.net/', versions: [['v3', 'latest'], ['v2']] },
  { slug: 'storybook', name: 'Storybook', category: 'testing', quadrant: 'Tools', layers: ['testing', 'frontend'], ring: 'Adopt', license: 'MIT', icon: 'storybook', url: 'https://storybook.js.org/', versions: [['10', 'latest'], ['9']] },
  { slug: 'eslint', name: 'ESLint', category: 'development', quadrant: 'Tools', layers: ['testing', 'development'], ring: 'Adopt', license: 'MIT', icon: 'eslint', url: 'https://eslint.org/', versions: [['9', 'latest']] },
  { slug: 'vite', name: 'Vite', category: 'tooling', quadrant: 'Tools', layers: ['frontend'], ring: 'Adopt', license: 'MIT', icon: 'vite', url: 'https://vite.dev/', versions: [['7', 'latest']] },
  // Observability and security
  { slug: 'opentelemetry', name: 'OpenTelemetry', category: 'observability', quadrant: 'Tools', layers: ['observability'], ring: 'Adopt', license: 'Apache-2.0', icon: 'opentelemetry', url: 'https://opentelemetry.io/', versions: [['1.x (stable signals)', 'latest']] },
  { slug: 'prometheus', name: 'Prometheus', category: 'observability', quadrant: 'Tools', layers: ['observability'], license: 'Apache-2.0', icon: 'prometheus', url: 'https://prometheus.io/', versions: [['3.x', 'latest'], ['2.53', 'lts', 'LTS']] },
  { slug: 'grafana', name: 'Grafana', category: 'observability', quadrant: 'Tools', layers: ['observability'], license: 'AGPL-3.0', icon: 'grafana', url: 'https://grafana.com/', versions: [['12', 'latest']] },
  { slug: 'trivy', name: 'Trivy', category: 'security', quadrant: 'Tools', layers: ['cicd', 'iac'], license: 'Apache-2.0', icon: 'trivy', url: 'https://trivy.dev/', versions: [['latest', 'latest']] },
  { slug: 'dependabot', name: 'Dependabot', category: 'security', quadrant: 'Tools', layers: ['cicd'], license: 'MIT', icon: 'dependabot', url: 'https://docs.github.com/code-security/dependabot', versions: [['Hosted', 'latest']] },
  // AI
  { slug: 'claude', name: 'Claude (Anthropic API)', category: 'ai', quadrant: 'Platforms', layers: ['ai'], license: 'Commercial', icon: 'anthropic', url: 'https://docs.anthropic.com/', versions: [['Model-based', 'latest']] },
  { slug: 'openai', name: 'OpenAI API', category: 'ai', quadrant: 'Platforms', layers: ['ai'], license: 'Commercial', icon: '', url: 'https://platform.openai.com/docs', versions: [['Model-based', 'latest']] },
  { slug: 'ollama', name: 'Ollama', category: 'ai', quadrant: 'Tools', layers: ['ai'], ring: 'Trial', license: 'MIT', icon: 'ollama', url: 'https://ollama.com/', tags: ['local'], versions: [['latest', 'latest']] },
  // Amazon Web Services (managed services; versions follow the service)
  { slug: 'aws-lambda', name: 'AWS Lambda', category: 'platform', quadrant: 'Platforms', layers: ['backend', 'infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/lambda/', tags: ['aws', 'serverless'], alternatives: ['Azure Functions', 'Google Cloud Run functions'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-ecs', name: 'Amazon ECS', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/ecs/', tags: ['aws', 'containers'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-eks', name: 'Amazon EKS', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/eks/', eol: 'amazon-eks', tags: ['aws', 'kubernetes'], versions: [['Kubernetes versions', 'latest', 'Follows upstream Kubernetes minor releases']] },
  { slug: 'amazon-s3', name: 'Amazon S3', category: 'storage', quadrant: 'Platforms', layers: ['data', 'infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/s3/', tags: ['aws', 'object-storage'], alternatives: ['Azure Blob Storage', 'MinIO'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-rds', name: 'Amazon RDS', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', url: 'https://aws.amazon.com/rds/', eol: 'amazon-rds-postgresql', tags: ['aws', 'managed-database'], versions: [['Engine versions', 'latest', 'PostgreSQL, MySQL, MariaDB, SQL Server, Oracle']] },
  { slug: 'amazon-dynamodb', name: 'Amazon DynamoDB', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', url: 'https://aws.amazon.com/dynamodb/', tags: ['aws', 'nosql'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-sqs', name: 'Amazon SQS', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Commercial', url: 'https://aws.amazon.com/sqs/', tags: ['aws', 'queue'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-sns', name: 'Amazon SNS', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Commercial', url: 'https://aws.amazon.com/sns/', tags: ['aws', 'pub-sub'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-eventbridge', name: 'Amazon EventBridge', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Commercial', url: 'https://aws.amazon.com/eventbridge/', tags: ['aws', 'events'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-api-gateway', name: 'Amazon API Gateway', category: 'networking', quadrant: 'Platforms', layers: ['communication', 'infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/api-gateway/', tags: ['aws', 'api-gateway'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-cloudfront', name: 'Amazon CloudFront', category: 'networking', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/cloudfront/', tags: ['aws', 'cdn'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-cognito', name: 'Amazon Cognito', category: 'identity', quadrant: 'Platforms', layers: ['backend'], license: 'Commercial', url: 'https://aws.amazon.com/cognito/', tags: ['aws', 'oidc'], versions: [['Service-based', 'latest']] },
  { slug: 'aws-secrets-manager', name: 'AWS Secrets Manager', category: 'security', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://aws.amazon.com/secrets-manager/', tags: ['aws', 'secrets'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-cloudwatch', name: 'Amazon CloudWatch', category: 'observability', quadrant: 'Platforms', layers: ['observability'], license: 'Commercial', url: 'https://aws.amazon.com/cloudwatch/', tags: ['aws', 'monitoring'], versions: [['Service-based', 'latest']] },
  { slug: 'amazon-opensearch-service', name: 'Amazon OpenSearch Service', category: 'search', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', url: 'https://aws.amazon.com/opensearch-service/', tags: ['aws', 'full-text', 'vector'], versions: [['OpenSearch versions', 'latest']] },
  { slug: 'amazon-bedrock', name: 'Amazon Bedrock', category: 'ai', quadrant: 'Platforms', layers: ['ai'], license: 'Commercial', url: 'https://aws.amazon.com/bedrock/', tags: ['aws', 'llm'], versions: [['Model-based', 'latest']] },
  // Microsoft Azure
  { slug: 'azure-app-service', name: 'Azure App Service', category: 'platform', quadrant: 'Platforms', layers: ['backend', 'infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/app-service/', tags: ['azure', 'paas'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-functions', name: 'Azure Functions', category: 'platform', quadrant: 'Platforms', layers: ['backend', 'infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/functions/', tags: ['azure', 'serverless'], alternatives: ['AWS Lambda'], versions: [['Runtime 4.x', 'latest']] },
  { slug: 'azure-container-apps', name: 'Azure Container Apps', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/container-apps/', tags: ['azure', 'containers'], versions: [['Service-based', 'latest']] },
  { slug: 'aks', name: 'Azure Kubernetes Service (AKS)', category: 'platform', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/kubernetes-service/', eol: 'azure-kubernetes-service', tags: ['azure', 'kubernetes'], versions: [['Kubernetes versions', 'latest', 'Follows upstream Kubernetes minor releases']] },
  { slug: 'azure-blob-storage', name: 'Azure Blob Storage', category: 'storage', quadrant: 'Platforms', layers: ['data', 'infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/storage/blobs/', tags: ['azure', 'object-storage'], alternatives: ['Amazon S3'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-sql-database', name: 'Azure SQL Database', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', url: 'https://azure.microsoft.com/products/azure-sql/database/', tags: ['azure', 'managed-database'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-cosmos-db', name: 'Azure Cosmos DB', category: 'database', quadrant: 'Platforms', layers: ['data'], license: 'Commercial', url: 'https://azure.microsoft.com/products/cosmos-db/', tags: ['azure', 'nosql', 'vector'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-service-bus', name: 'Azure Service Bus', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Commercial', url: 'https://azure.microsoft.com/products/service-bus/', tags: ['azure', 'queue'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-event-hubs', name: 'Azure Event Hubs', category: 'messaging', quadrant: 'Platforms', layers: ['communication'], license: 'Commercial', url: 'https://azure.microsoft.com/products/event-hubs/', tags: ['azure', 'streaming'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-api-management', name: 'Azure API Management', category: 'networking', quadrant: 'Platforms', layers: ['communication', 'infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/api-management/', tags: ['azure', 'api-gateway'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-front-door', name: 'Azure Front Door', category: 'networking', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/frontdoor/', tags: ['azure', 'cdn'], versions: [['Service-based', 'latest']] },
  { slug: 'entra-id', name: 'Microsoft Entra ID', category: 'identity', quadrant: 'Platforms', layers: ['backend'], license: 'Commercial', url: 'https://www.microsoft.com/security/business/identity-access/microsoft-entra-id', tags: ['azure', 'oidc', 'saml'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-key-vault', name: 'Azure Key Vault', category: 'security', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', url: 'https://azure.microsoft.com/products/key-vault/', tags: ['azure', 'secrets'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-monitor', name: 'Azure Monitor', category: 'observability', quadrant: 'Platforms', layers: ['observability'], license: 'Commercial', url: 'https://azure.microsoft.com/products/monitor/', tags: ['azure', 'monitoring', 'application-insights'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-ai-search', name: 'Azure AI Search', category: 'search', quadrant: 'Platforms', layers: ['data', 'ai'], license: 'Commercial', url: 'https://azure.microsoft.com/products/ai-services/ai-search/', tags: ['azure', 'full-text', 'vector'], versions: [['Service-based', 'latest']] },
  { slug: 'azure-openai', name: 'Azure OpenAI', category: 'ai', quadrant: 'Platforms', layers: ['ai'], license: 'Commercial', url: 'https://azure.microsoft.com/products/ai-services/openai-service/', tags: ['azure', 'llm'], versions: [['Model-based', 'latest']] },
  // Search, storage, identity and networking
  { slug: 'opensearch', name: 'OpenSearch', category: 'search', quadrant: 'Platforms', layers: ['data'], ring: 'Trial', license: 'Apache-2.0', icon: 'opensearch', url: 'https://opensearch.org/', tags: ['full-text', 'vector'], alternatives: ['Elasticsearch'], versions: [['3.x', 'latest'], ['2.x']] },
  { slug: 'meilisearch', name: 'Meilisearch', category: 'search', quadrant: 'Platforms', layers: ['data'], ring: 'Assess', license: 'MIT', icon: 'meilisearch', url: 'https://www.meilisearch.com/', tags: ['full-text', 'typo-tolerant'], versions: [['1.x', 'latest']] },
  { slug: 'typesense', name: 'Typesense', category: 'search', quadrant: 'Platforms', layers: ['data'], license: 'GPL-3.0-only', url: 'https://typesense.org/', tags: ['full-text', 'vector'], versions: [['Current release', 'latest']] },
  { slug: 'apache-solr', name: 'Apache Solr', category: 'search', quadrant: 'Platforms', layers: ['data'], license: 'Apache-2.0', icon: 'apachesolr', url: 'https://solr.apache.org/', eol: 'apache-solr', tags: ['full-text'], versions: [['9.x', 'latest']] },
  { slug: 'algolia', name: 'Algolia', category: 'search', quadrant: 'Platforms', layers: ['data', 'frontend'], license: 'Commercial', icon: 'algolia', url: 'https://www.algolia.com/', tags: ['full-text', 'hosted'], versions: [['Service-based', 'latest']] },
  { slug: 'minio', name: 'MinIO', category: 'storage', quadrant: 'Platforms', layers: ['data', 'infrastructure'], license: 'AGPL-3.0-only', icon: 'minio', url: 'https://min.io/', tags: ['object-storage', 's3-compatible'], versions: [['Rolling releases', 'latest']] },
  { slug: 'keycloak', name: 'Keycloak', category: 'identity', quadrant: 'Platforms', layers: ['backend', 'infrastructure'], ring: 'Trial', license: 'Apache-2.0', icon: 'keycloak', url: 'https://www.keycloak.org/', tags: ['oidc', 'saml', 'self-hosted'], versions: [['26.x', 'latest']] },
  { slug: 'auth0', name: 'Auth0', category: 'identity', quadrant: 'Platforms', layers: ['backend'], license: 'Commercial', icon: 'auth0', url: 'https://auth0.com/', tags: ['oidc', 'hosted'], versions: [['Service-based', 'latest']] },
  { slug: 'okta', name: 'Okta', category: 'identity', quadrant: 'Platforms', layers: ['backend'], license: 'Commercial', icon: 'okta', url: 'https://www.okta.com/', tags: ['oidc', 'saml', 'hosted'], versions: [['Service-based', 'latest']] },
  { slug: 'cloudflare', name: 'Cloudflare', category: 'networking', quadrant: 'Platforms', layers: ['infrastructure'], license: 'Commercial', icon: 'cloudflare', url: 'https://www.cloudflare.com/', tags: ['cdn', 'waf', 'dns'], versions: [['Service-based', 'latest']] },
  { slug: 'traefik', name: 'Traefik Proxy', category: 'networking', quadrant: 'Platforms', layers: ['infrastructure'], license: 'MIT', icon: 'traefikproxy', url: 'https://traefik.io/traefik/', tags: ['reverse-proxy', 'ingress'], versions: [['3.x', 'latest']] },
  { slug: 'kong', name: 'Kong Gateway', category: 'networking', quadrant: 'Platforms', layers: ['communication', 'infrastructure'], license: 'Apache-2.0', icon: 'kong', url: 'https://konghq.com/products/kong-gateway', tags: ['api-gateway'], versions: [['3.x', 'latest']] },
  // Development environment: editors, formatters, linters, package managers, build systems
  { slug: 'vscode', name: 'Visual Studio Code', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Adopt', license: 'Proprietary', url: 'https://code.visualstudio.com/', tags: ['ide', 'editor'], rationale: 'The Microsoft build is proprietary freeware; the Code - OSS sources are MIT.', versions: [['Monthly releases', 'latest']] },
  { slug: 'jetbrains-ides', name: 'JetBrains IDEs', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'Commercial', icon: 'jetbrains', url: 'https://www.jetbrains.com/ides/', tags: ['ide', 'intellij', 'pycharm', 'rider', 'clion'], versions: [['Yearly releases', 'latest']] },
  { slug: 'editorconfig', name: 'EditorConfig', category: 'development', quadrant: 'Techniques', layers: ['development'], ring: 'Adopt', license: 'Standard', icon: 'editorconfig', url: 'https://editorconfig.org/', tags: ['conventions'], versions: [['Specification', 'latest']] },
  { slug: 'prettier', name: 'Prettier', category: 'development', quadrant: 'Tools', layers: ['development', 'frontend'], ring: 'Adopt', license: 'MIT', icon: 'prettier', url: 'https://prettier.io/', tags: ['formatter', 'typescript'], alternatives: ['Biome'], versions: [['3.x', 'latest']] },
  { slug: 'biome', name: 'Biome', category: 'development', quadrant: 'Tools', layers: ['development', 'frontend'], ring: 'Assess', license: 'MIT OR Apache-2.0', icon: 'biome', url: 'https://biomejs.dev/', tags: ['formatter', 'linter', 'typescript'], alternatives: ['ESLint', 'Prettier'], versions: [['2.x', 'latest']] },
  { slug: 'ruff', name: 'Ruff', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Adopt', license: 'MIT', icon: 'ruff', url: 'https://docs.astral.sh/ruff/', tags: ['formatter', 'linter', 'python'], alternatives: ['Black', 'Flake8'], versions: [['0.x', 'latest', 'Pre-1.0; pin minor versions']] },
  { slug: 'mypy', name: 'mypy', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', url: 'https://mypy-lang.org/', tags: ['type-checker', 'python'], versions: [['1.x', 'latest']] },
  { slug: 'uv', name: 'uv', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Trial', license: 'MIT OR Apache-2.0', icon: 'uv', url: 'https://docs.astral.sh/uv/', tags: ['package-manager', 'python'], alternatives: ['Poetry', 'pip'], versions: [['0.x', 'latest']] },
  { slug: 'poetry', name: 'Poetry', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', icon: 'poetry', url: 'https://python-poetry.org/', tags: ['package-manager', 'python'], versions: [['2.x', 'latest']] },
  { slug: 'pnpm', name: 'pnpm', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Adopt', license: 'MIT', icon: 'pnpm', url: 'https://pnpm.io/', tags: ['package-manager', 'typescript'], alternatives: ['npm', 'Yarn'], versions: [['11.x', 'latest'], ['10.x']] },
  { slug: 'nuget', name: 'NuGet', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'Apache-2.0', icon: 'nuget', url: 'https://www.nuget.org/', tags: ['package-manager', 'dotnet'], versions: [['Ships with the .NET SDK', 'latest']] },
  { slug: 'dotnet-format', name: 'dotnet format', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', url: 'https://learn.microsoft.com/dotnet/core/tools/dotnet-format', tags: ['formatter', 'dotnet', 'csharp'], versions: [['Ships with the .NET SDK', 'latest']] },
  { slug: 'cmake', name: 'CMake', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Adopt', license: 'BSD-3-Clause', icon: 'cmake', url: 'https://cmake.org/', tags: ['build-system', 'cpp'], versions: [['4.x', 'latest'], ['3.31']] },
  { slug: 'conan', name: 'Conan', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', icon: 'conan', url: 'https://conan.io/', tags: ['package-manager', 'cpp'], alternatives: ['vcpkg'], versions: [['2.x', 'latest']] },
  { slug: 'vcpkg', name: 'vcpkg', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', url: 'https://vcpkg.io/', tags: ['package-manager', 'cpp'], alternatives: ['Conan'], versions: [['Rolling releases', 'latest']] },
  { slug: 'clang-format', name: 'clang-format and clang-tidy', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'Apache-2.0 WITH LLVM-exception', url: 'https://clang.llvm.org/docs/ClangFormat.html', tags: ['formatter', 'linter', 'cpp'], versions: [['LLVM releases', 'latest']] },
  { slug: 'gradle', name: 'Gradle', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'Apache-2.0', icon: 'gradle', url: 'https://gradle.org/', tags: ['build-system', 'java', 'kotlin'], versions: [['9.x', 'latest'], ['8.x']] },
  { slug: 'maven', name: 'Apache Maven', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'Apache-2.0', icon: 'apachemaven', url: 'https://maven.apache.org/', tags: ['build-system', 'java'], versions: [['3.9', 'latest']] },
  { slug: 'git', name: 'Git', category: 'development', quadrant: 'Tools', layers: ['development'], ring: 'Adopt', license: 'GPL-2.0-only', icon: 'git', url: 'https://git-scm.com/', tags: ['version-control'], versions: [['2.x', 'latest']] },
  { slug: 'pre-commit', name: 'pre-commit', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', icon: 'precommit', url: 'https://pre-commit.com/', tags: ['git-hooks'], alternatives: ['Lefthook', 'Husky'], versions: [['4.x', 'latest']] },
  { slug: 'lefthook', name: 'Lefthook', category: 'development', quadrant: 'Tools', layers: ['development'], license: 'MIT', icon: 'lefthook', url: 'https://lefthook.dev/', tags: ['git-hooks'], versions: [['1.x', 'latest']] },
  { slug: 'conventional-commits', name: 'Conventional Commits', category: 'development', quadrant: 'Techniques', layers: ['development', 'cicd'], ring: 'Adopt', license: 'CC-BY-3.0', icon: 'conventionalcommits', url: 'https://www.conventionalcommits.org/', tags: ['conventions', 'commit-messages'], versions: [['1.0.0', 'latest']] },
  { slug: 'renovate', name: 'Renovate', category: 'security', quadrant: 'Tools', layers: ['cicd', 'development'], license: 'AGPL-3.0-only', icon: 'renovate', url: 'https://docs.renovatebot.com/', tags: ['dependency-updates'], alternatives: ['Dependabot'], versions: [['Hosted or self-hosted', 'latest']] },
  { slug: 'dev-containers', name: 'Dev Containers', category: 'development', quadrant: 'Techniques', layers: ['development'], license: 'MIT', url: 'https://containers.dev/', tags: ['reproducible-environment'], versions: [['Specification', 'latest']] },
];

export const catalogSeed: Technology[] = entries.map((e) => {
  const list = versions(e.versions);
  const preferred = list.find((v) => v.latest) ?? list[0];
  return {
    id: seedId(e.slug),
    name: e.name,
    version: preferred?.version ?? '',
    quadrant: e.quadrant,
    ring: e.ring ?? 'Assess',
    owner: '',
    rationale: e.rationale ?? '',
    license: e.license ?? '',
    support: list.filter((v) => v.support).map((v) => `${v.version}: ${v.support}`).join('; '),
    tags: [e.slug, ...(e.tags ?? [])],
    alternatives: e.alternatives ?? [],
    references: [
      { id: `${e.slug}-official`, title: `${e.name} — official site`, url: e.url, kind: 'official' as const },
      ...(e.eol
        ? [{ id: `${e.slug}-eol`, title: `${e.name} release and support dates`, url: `https://endoflife.date/${e.eol}`, kind: 'official' as const }]
        : []),
    ],
    reviewDate: '2026-12-31',
    decisionIds: [],
    category: e.category,
    layers: e.layers,
    versions: list,
    icon: e.icon ?? '',
    source: 'seed' as const,
    history: [{ ring: e.ring ?? 'Assess', at: '2026-06-01T00:00:00.000Z', by: 'seed', note: `Seeded catalog (${seedVerifiedAt})` }],
  };
});
export const seedSlugs = new Map(entries.map((e) => [e.slug, seedId(e.slug)]));
