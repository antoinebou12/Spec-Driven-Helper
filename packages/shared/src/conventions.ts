import type { Localized } from './template-types';

/**
 * Naming and folder conventions per language, following each community's reference style guide.
 * Used to suggest answers for conventions.1 (naming) and conventions.2 (repository structure), for
 * the conventions guide on the Stack view, and in the implementation bundle.
 */
export const caseStyles = ['camelCase', 'PascalCase', 'snake_case', 'kebab-case', 'SCREAMING_SNAKE_CASE'] as const;
export type CaseStyle = (typeof caseStyles)[number];

/** Splits an identifier in any common style into lower-case words; keeps acronyms together. */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
export function toCase(name: string, style: CaseStyle): string {
  const words = splitWords(name);
  switch (style) {
    case 'camelCase':
      return words.map((w, i) => (i ? capital(w) : w)).join('');
    case 'PascalCase':
      return words.map(capital).join('');
    case 'snake_case':
      return words.join('_');
    case 'kebab-case':
      return words.join('-');
    case 'SCREAMING_SNAKE_CASE':
      return words.join('_').toUpperCase();
  }
}

/** The style a name is written in, or undefined when it mixes styles or is a single ambiguous word. */
export function detectCase(name: string): CaseStyle | undefined {
  if (/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(name)) return 'camelCase';
  if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(name)) return 'snake_case';
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(name)) return 'kebab-case';
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(name)) return 'SCREAMING_SNAKE_CASE';
  return undefined;
}

export const conventionElements = ['files', 'folders', 'types', 'functions', 'variables', 'constants', 'tests'] as const;
export type ConventionElement = (typeof conventionElements)[number];
export const elementLabels: Record<ConventionElement, Localized> = {
  files: { en: 'Files and modules', fr: 'Fichiers et modules' },
  folders: { en: 'Folders and packages', fr: 'Dossiers et paquets' },
  types: { en: 'Types, classes, interfaces', fr: 'Types, classes, interfaces' },
  functions: { en: 'Functions and methods', fr: 'Fonctions et méthodes' },
  variables: { en: 'Variables and parameters', fr: 'Variables et paramètres' },
  constants: { en: 'Constants', fr: 'Constantes' },
  tests: { en: 'Tests', fr: 'Tests' },
};

type Rule = { style: string; example: string };
export type LanguageConventions = {
  id: string;
  name: string;
  /** Catalog slugs that imply this language. */
  slugs: string[];
  rules: Record<ConventionElement, Rule>;
  layout: string;
  tools: string[];
  notes: Localized;
  reference: { title: string; url: string };
};

export const languageConventions: LanguageConventions[] = [
  {
    id: 'typescript',
    name: 'TypeScript / JavaScript',
    slugs: ['typescript', 'javascript', 'nodejs', 'deno', 'react', 'angular', 'vue', 'svelte', 'nextjs', 'nestjs', 'fastify', 'express'],
    rules: {
      files: { style: 'kebab-case; React components PascalCase', example: 'user-service.ts, UserCard.tsx' },
      folders: { style: 'kebab-case', example: 'src/features/order-history/' },
      types: { style: 'PascalCase', example: 'OrderSummary, PaymentStatus' },
      functions: { style: 'camelCase', example: 'calculateTotal()' },
      variables: { style: 'camelCase', example: 'retryCount' },
      constants: { style: 'camelCase, or SCREAMING_SNAKE_CASE for fixed values', example: 'MAX_RETRIES' },
      tests: { style: '*.test.ts beside the code', example: 'user-service.test.ts' },
    },
    layout: 'package.json\ntsconfig.json\nsrc/\n  features/<feature>/\n  lib/\n  index.ts\ntests/\n  e2e/',
    tools: ['ESLint (typescript-eslint)', 'Prettier or Biome', 'EditorConfig'],
    notes: {
      en: 'Avoid the I prefix on interfaces and default exports for shared modules.',
      fr: 'Évitez le préfixe I sur les interfaces et les exports par défaut pour les modules partagés.',
    },
    reference: { title: 'Google TypeScript Style Guide', url: 'https://google.github.io/styleguide/tsguide.html' },
  },
  {
    id: 'python',
    name: 'Python',
    slugs: ['python', 'django', 'fastapi', 'flask', 'pytest'],
    rules: {
      files: { style: 'snake_case, short and lower case', example: 'user_service.py' },
      folders: { style: 'snake_case packages (no hyphens)', example: 'src/order_history/' },
      types: { style: 'PascalCase; exceptions end in Error', example: 'OrderSummary, PaymentError' },
      functions: { style: 'snake_case', example: 'calculate_total()' },
      variables: { style: 'snake_case; _leading underscore when internal', example: 'retry_count, _cache' },
      constants: { style: 'SCREAMING_SNAKE_CASE at module level', example: 'MAX_RETRIES' },
      tests: { style: 'tests/test_*.py', example: 'tests/test_user_service.py' },
    },
    layout: 'pyproject.toml\nsrc/<package_name>/\n  __init__.py\n  <module>.py\ntests/\n  test_<module>.py',
    tools: ['Ruff (lint and format)', 'mypy or pyright', 'uv or Poetry'],
    notes: {
      en: 'Distribution names may use hyphens (my-package); the import package uses underscores (my_package).',
      fr: 'Le nom de distribution peut contenir des tirets (my-package) ; le paquet importé utilise des soulignés (my_package).',
    },
    reference: { title: 'PEP 8 — Style Guide for Python Code', url: 'https://peps.python.org/pep-0008/' },
  },
  {
    id: 'csharp',
    name: 'C# / .NET',
    slugs: ['csharp', 'dotnet', 'aspnet-core', 'blazor', 'maui', 'wpf', 'winui', 'xunit'],
    rules: {
      files: { style: 'PascalCase, one type per file named after it', example: 'UserService.cs' },
      folders: { style: 'PascalCase, matching the namespace', example: 'src/Contoso.Orders.Api/' },
      types: { style: 'PascalCase; interfaces start with I', example: 'OrderSummary, IOrderRepository' },
      functions: { style: 'PascalCase; asynchronous methods end in Async', example: 'CalculateTotalAsync()' },
      variables: { style: 'camelCase; private fields _camelCase', example: 'retryCount, _logger' },
      constants: { style: 'PascalCase', example: 'MaxRetries' },
      tests: { style: '<Project>.Tests project; Method_State_Expected', example: 'Total_WithDiscount_ReturnsReducedPrice' },
    },
    layout: '<Product>.sln\nDirectory.Build.props\n.editorconfig\nsrc/\n  <Product>.Api/<Product>.Api.csproj\n  <Product>.Domain/\ntests/\n  <Product>.Api.Tests/',
    tools: ['dotnet format', '.NET analyzers', 'EditorConfig'],
    notes: {
      en: 'Namespaces follow Company.Product.Feature and mirror the folder tree.',
      fr: 'Les espaces de noms suivent Entreprise.Produit.Fonction et reflètent l’arborescence.',
    },
    reference: { title: '.NET identifier naming rules and conventions', url: 'https://learn.microsoft.com/dotnet/csharp/fundamentals/coding-style/identifier-names' },
  },
  {
    id: 'cpp',
    name: 'C / C++',
    slugs: ['cpp', 'c', 'qt', 'cmake'],
    rules: {
      files: { style: 'snake_case; .hpp / .cpp pairs', example: 'user_service.hpp, user_service.cpp' },
      folders: { style: 'snake_case; public headers under include/<project>/', example: 'include/orders/' },
      types: { style: 'PascalCase', example: 'OrderSummary' },
      functions: { style: 'snake_case (standard library style) or PascalCase (Google style) — pick one', example: 'calculate_total()' },
      variables: { style: 'snake_case; data members end in _', example: 'retry_count, cache_' },
      constants: { style: 'kPascalCase; macros SCREAMING_SNAKE_CASE', example: 'kMaxRetries, ORDERS_EXPORT' },
      tests: { style: 'tests/<name>_test.cpp', example: 'tests/user_service_test.cpp' },
    },
    layout: 'CMakeLists.txt\ncmake/\ninclude/<project>/\n  <module>.hpp\nsrc/\n  <module>.cpp\ntests/\n  <module>_test.cpp',
    tools: ['clang-format', 'clang-tidy', 'CMake with vcpkg or Conan'],
    notes: {
      en: 'C++ has no single official style: record the chosen guide in .clang-format and .clang-tidy and let the tools enforce it.',
      fr: 'Le C++ n’a pas de style officiel unique : consignez le guide choisi dans .clang-format et .clang-tidy et laissez les outils l’appliquer.',
    },
    reference: { title: 'C++ Core Guidelines — naming and layout', url: 'https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#S-naming' },
  },
  {
    id: 'java',
    name: 'Java / Kotlin',
    slugs: ['java', 'kotlin', 'spring-boot', 'junit', 'gradle', 'maven'],
    rules: {
      files: { style: 'PascalCase, named after the top-level class', example: 'UserService.java' },
      folders: { style: 'lower-case packages, reverse domain', example: 'com/contoso/orders/' },
      types: { style: 'PascalCase', example: 'OrderSummary' },
      functions: { style: 'camelCase', example: 'calculateTotal()' },
      variables: { style: 'camelCase', example: 'retryCount' },
      constants: { style: 'SCREAMING_SNAKE_CASE (static final)', example: 'MAX_RETRIES' },
      tests: { style: '*Test in src/test/java', example: 'UserServiceTest.java' },
    },
    layout: 'build.gradle.kts or pom.xml\nsrc/\n  main/java/com/<company>/<product>/\n  main/resources/\n  test/java/com/<company>/<product>/',
    tools: ['Spotless or Checkstyle', 'Gradle or Maven wrapper'],
    notes: { en: 'Kotlin follows the same casing; files may hold several declarations.', fr: 'Kotlin suit la même casse ; un fichier peut contenir plusieurs déclarations.' },
    reference: { title: 'Google Java Style Guide', url: 'https://google.github.io/styleguide/javaguide.html' },
  },
  {
    id: 'go',
    name: 'Go',
    slugs: ['go'],
    rules: {
      files: { style: 'snake_case', example: 'user_service.go' },
      folders: { style: 'short lower-case package names, no underscores', example: 'internal/orders/' },
      types: { style: 'PascalCase when exported, camelCase otherwise', example: 'OrderSummary, orderCache' },
      functions: { style: 'PascalCase when exported, camelCase otherwise', example: 'CalculateTotal()' },
      variables: { style: 'camelCase, short in small scopes; keep acronyms upper case', example: 'userID, srv' },
      constants: { style: 'MixedCaps like other identifiers', example: 'MaxRetries' },
      tests: { style: '*_test.go beside the code', example: 'user_service_test.go' },
    },
    layout: 'go.mod\ncmd/\n  <app>/main.go\ninternal/\n  <package>/\npkg/ (only for code meant for other modules)',
    tools: ['gofmt', 'go vet', 'golangci-lint'],
    notes: { en: 'Capitalisation controls visibility: exported names start with an upper-case letter.', fr: 'La majuscule contrôle la visibilité : les noms exportés commencent par une majuscule.' },
    reference: { title: 'Effective Go — names', url: 'https://go.dev/doc/effective_go#names' },
  },
  {
    id: 'rust',
    name: 'Rust',
    slugs: ['rust', 'tauri'],
    rules: {
      files: { style: 'snake_case modules', example: 'user_service.rs' },
      folders: { style: 'snake_case modules; crate names kebab-case in Cargo.toml', example: 'src/order_history/' },
      types: { style: 'PascalCase (types, traits, enum variants)', example: 'OrderSummary' },
      functions: { style: 'snake_case', example: 'calculate_total()' },
      variables: { style: 'snake_case', example: 'retry_count' },
      constants: { style: 'SCREAMING_SNAKE_CASE (const and static)', example: 'MAX_RETRIES' },
      tests: { style: 'unit tests in #[cfg(test)] mod tests; integration tests in tests/', example: 'tests/orders.rs' },
    },
    layout: 'Cargo.toml\nsrc/\n  lib.rs\n  main.rs\n  bin/\ntests/\nbenches/',
    tools: ['rustfmt', 'clippy'],
    notes: { en: 'A crate named my-crate is imported as my_crate.', fr: 'Une crate nommée my-crate s’importe sous le nom my_crate.' },
    reference: { title: 'Rust API Guidelines — naming', url: 'https://rust-lang.github.io/api-guidelines/naming.html' },
  },
];

/** Languages whose conventions apply to a stack, in catalog order. */
export function languagesForStack(slugs: Iterable<string>): LanguageConventions[] {
  const set = new Set(slugs);
  return languageConventions.filter((l) => l.slugs.some((s) => set.has(s)));
}

const pick = (value: Localized, lang: 'en' | 'fr') => value[lang];

/** Suggested answer for conventions.1 (naming), one block per language. */
export function namingMarkdown(languages: LanguageConventions[], lang: 'en' | 'fr') {
  return languages
    .map((l) => {
      const rows = Object.entries(l.rules).map(
        ([element, rule]) => `| ${pick(elementLabels[element as ConventionElement], lang)} | ${rule.style} | \`${rule.example}\` |`,
      );
      const head = lang === 'fr' ? '| Élément | Convention | Exemple |' : '| Element | Convention | Example |';
      return `**${l.name}** — [${l.reference.title}](${l.reference.url})\n\n${head}\n| --- | --- | --- |\n${rows.join('\n')}\n\n${pick(l.notes, lang)}`;
    })
    .join('\n\n');
}

/** Suggested answer for conventions.2 (repository structure), one tree per language. */
export function layoutMarkdown(languages: LanguageConventions[], lang: 'en' | 'fr') {
  const tools = lang === 'fr' ? 'Outils' : 'Tools';
  return languages
    .map((l) => `**${l.name}**\n\n\`\`\`text\n${l.layout}\n\`\`\`\n\n${tools}: ${l.tools.join(', ')}.`)
    .join('\n\n');
}
