import { describe, expect, it } from 'vitest';
import {
  caseStyles,
  conventionElements,
  detectCase,
  languageConventions,
  languagesForStack,
  layoutMarkdown,
  namingMarkdown,
  splitWords,
  toCase,
} from '../packages/shared/src/conventions';
import { createSpec } from '../packages/shared/src/domain';
import { stackAnswerSuggestions } from '../packages/shared/src/stack';
import { catalogSeed, seedSlugs } from '../apps/api/src/catalog-seed';
import { implementationFiles } from '../apps/api/src/exports';

describe('case styles', () => {
  it('splits identifiers written in any style, keeping acronyms together', () => {
    expect(splitWords('orderHistoryItem')).toEqual(['order', 'history', 'item']);
    expect(splitWords('HTTPServerError')).toEqual(['http', 'server', 'error']);
    expect(splitWords('user_id-value 2')).toEqual(['user', 'id', 'value', '2']);
    expect(splitWords('  ')).toEqual([]);
  });

  it('converts between styles and round-trips', () => {
    const name = 'order history item';
    expect(caseStyles.map((s) => toCase(name, s))).toEqual([
      'orderHistoryItem',
      'OrderHistoryItem',
      'order_history_item',
      'order-history-item',
      'ORDER_HISTORY_ITEM',
    ]);
    for (const from of caseStyles) for (const to of caseStyles) expect(toCase(toCase(name, from), to)).toBe(toCase(name, to));
  });

  it('detects the style of a name, and nothing for plain or mixed names', () => {
    expect(caseStyles.map((s) => detectCase(toCase('order history item', s)))).toEqual([...caseStyles]);
    expect(detectCase('order')).toBeUndefined();
    expect(detectCase('order_History')).toBeUndefined();
    expect(detectCase('Order-history')).toBeUndefined();
  });
});

describe('language conventions', () => {
  it('cover every element, a layout, tools and a reference for each language', () => {
    expect(languageConventions.map((l) => l.id)).toEqual(['typescript', 'python', 'csharp', 'cpp', 'java', 'go', 'rust']);
    for (const l of languageConventions) {
      expect(Object.keys(l.rules).sort()).toEqual([...conventionElements].sort());
      expect(l.layout).toContain('\n');
      expect(l.tools.length).toBeGreaterThan(0);
      expect(l.reference.url).toMatch(/^https:\/\//);
      expect(l.notes.en && l.notes.fr).toBeTruthy();
    }
  });

  it('follow each community style: snake_case Python, PascalCase C#, kebab-case TypeScript files', () => {
    const by = Object.fromEntries(languageConventions.map((l) => [l.id, l]));
    expect(detectCase(by.python.rules.functions.example.replace('()', ''))).toBe('snake_case');
    expect(detectCase(by.csharp.rules.functions.example.replace('()', ''))).toBe('PascalCase');
    expect(detectCase(by.typescript.rules.files.example.split('.')[0])).toBe('kebab-case');
    expect(detectCase(by.rust.rules.constants.example)).toBe('SCREAMING_SNAKE_CASE');
  });

  it('only reference catalog slugs that exist', () => {
    const slugs = new Set(seedSlugs.keys());
    const unknown = languageConventions.flatMap((l) => l.slugs.filter((s) => !slugs.has(s)).map((s) => `${l.id}: ${s}`));
    // Some frameworks (Express, MAUI, WPF, WinUI, Qt, Tauri) may be absent from the seed; they still imply the language.
    expect(unknown.every((u) => /express|maui|wpf|winui|qt|tauri|react-native/.test(u))).toBe(true);
  });

  it('are detected from the stack, in a stable order', () => {
    expect(languagesForStack(['fastapi', 'react', 'aspnet-core']).map((l) => l.id)).toEqual(['typescript', 'python', 'csharp']);
    expect(languagesForStack(['postgresql'])).toEqual([]);
  });

  it('render bilingual Markdown answers with a table and a folder tree', () => {
    const python = languagesForStack(['python']);
    expect(namingMarkdown(python, 'en')).toContain('| Element | Convention | Example |');
    expect(namingMarkdown(python, 'fr')).toContain('| Élément | Convention | Exemple |');
    expect(namingMarkdown(python, 'en')).toContain('`calculate_total()`');
    expect(layoutMarkdown(python, 'fr')).toContain('```text\npyproject.toml');
    expect(layoutMarkdown(python, 'fr')).toContain('Outils: Ruff');
  });
});

describe('stack suggestions and exports', () => {
  const spec = () => {
    const s = createSpec(crypto.randomUUID(), 'Conventions');
    s.stack = [
      { technologyId: seedSlugs.get('python')!, layer: 'backend', version: '', note: '' },
      { technologyId: seedSlugs.get('cpp')!, layer: 'desktop', version: '', note: '' },
    ];
    return s;
  };

  it('fill empty naming and structure answers from the stack languages', () => {
    const answers = Object.assign({}, ...(stackAnswerSuggestions(spec(), catalogSeed, 'en').sections ?? []).map((s) => s.answers));
    expect(answers['conventions.1'].value).toContain('**Python**');
    expect(answers['conventions.1'].value).toContain('**C / C++**');
    expect(answers['conventions.2'].value).toContain('include/<project>/');
  });

  it('never overwrite an answered naming question', () => {
    const s = spec();
    s.sections.find((x) => x.id === 'conventions')!.answers['conventions.1'] = { value: 'Our own rules', state: 'answered', reason: '' };
    const answers = Object.assign({}, ...(stackAnswerSuggestions(s, catalogSeed, 'en').sections ?? []).map((x) => x.answers));
    expect(answers['conventions.1']).toBeUndefined();
    expect(answers['conventions.2']).toBeDefined();
  });

  it('add .plan/conventions.md to the implementation bundle when the stack has languages', () => {
    const files = implementationFiles(spec(), catalogSeed);
    expect(files['.plan/conventions.md']).toContain('# Naming and folder conventions');
    expect(files['.plan/conventions.md']).toContain('PEP 8');
    expect(implementationFiles(createSpec(crypto.randomUUID(), 'Empty'), catalogSeed)['.plan/conventions.md']).toBeUndefined();
  });
});
