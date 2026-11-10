import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toString } from 'mdast-util-to-string';
import { z } from 'zod';
import { secretFile } from './import-rules';

export const openspecLimits = { files: 400, fileBytes: 2_000_000, totalBytes: 12_000_000 };
export type OpenSpecDiagnostic = {
  code: string;
  path: string;
  en: string;
  fr: string;
  severity: 'warning' | 'error';
};
export const diagnostic = (
  code: string,
  path: string,
  en: string,
  fr: string,
  severity: 'warning' | 'error' = 'warning',
): OpenSpecDiagnostic => ({ code, path, en, fr, severity });
export const openSpecManifestSchema = z.object({
  format: z.literal('sdd-openspec'),
  version: z.literal(1),
  projectId: z.string().uuid(),
  sourceRevision: z.number().int().nonnegative(),
  requirements: z
    .array(
      z.object({
        path: z.string().max(500),
        name: z.string().max(600),
        itemId: z.string().max(60),
        sectionId: z.string().max(100),
      }),
    )
    .max(500),
});
export type OpenSpecManifest = z.infer<typeof openSpecManifestSchema>;
export type RequirementBlock = {
  operation: 'snapshot' | 'added' | 'modified' | 'removed' | 'renamed';
  name: string;
  body: string;
  acceptance: string;
  to?: string;
};

export function markdownTree(markdown: string) {
  return unified().use(remarkParse).parse(markdown);
}

/** Only top-level headings delimit contracts; fenced examples and HTML are inert. */
export function requirementBlocks(
  markdown: string,
  diagnostics: OpenSpecDiagnostic[] = [],
  path = '',
): RequirementBlock[] {
  const nodes = markdownTree(markdown).children;
  const out: RequirementBlock[] = [];
  let operation: RequirementBlock['operation'] | null = 'snapshot';
  const malformed = () =>
    diagnostics.push(
      diagnostic(
        'unsupported-delta',
        path,
        'Unsupported or incomplete requirement operation.',
        'Operation sur une exigence non prise en charge ou incomplete.',
        'error',
      ),
    );
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'heading' && node.depth === 2) {
      const heading = toString(node).trim();
      const match = /^(ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/.exec(heading);
      if (!match && /Requirements$/i.test(heading) && heading !== 'Requirements') malformed();
      operation = match
        ? (match[1].toLowerCase() as RequirementBlock['operation'])
        : heading === 'Requirements'
          ? 'snapshot'
          : null;
    }
    if (operation === 'renamed' && node.type === 'list') {
      let from: string | undefined;
      for (const item of node.children) {
        const line = toString(item).trim();
        const match = /^(FROM|TO):\s*(?:### Requirement:\s*)?(.+)$/.exec(line);
        if (match?.[1] === 'FROM') {
          if (from) malformed();
          from = match[2];
        } else if (match?.[1] === 'TO' && from) {
          out.push({ operation, name: from, to: match[2], body: '', acceptance: '' });
          from = undefined;
        } else malformed();
      }
      if (from) malformed();
    }
    if (!operation || operation === 'renamed' || node.type !== 'heading' || node.depth !== 3)
      continue;
    const name = /^Requirement:\s*(.+)$/.exec(toString(node))?.[1];
    if (!name) continue;
    let end = i + 1;
    while (
      end < nodes.length &&
      !(nodes[end].type === 'heading' && (nodes[end] as { depth: number }).depth <= 3)
    )
      end++;
    const scenario = nodes
      .slice(i + 1, end)
      .find(
        (n) =>
          n.type === 'heading' &&
          n.depth === 4 &&
          (/^Scenario:\s*\S/.test(toString(n)) || toString(n) === 'Acceptance criteria'),
      );
    const endOffset = nodes[end]?.position?.start.offset ?? markdown.length;
    const split = scenario?.position?.start.offset ?? endOffset;
    out.push({
      operation,
      name: name.trim(),
      body: markdown.slice(node.position!.end.offset!, split).trim(),
      acceptance: scenario
        ? markdown
            .slice(
              toString(scenario) === 'Acceptance criteria' ? scenario.position!.end.offset! : split,
              endOffset,
            )
            .trim()
        : '',
    });
  }
  return out;
}

export function hasScenarios(value: string) {
  const nodes = markdownTree(value).children;
  const starts = nodes.flatMap((n, i) =>
    n.type === 'heading' && n.depth === 4 && /^Scenario:\s*\S/.test(toString(n)) ? [i] : [],
  );
  return (
    starts.length > 0 &&
    starts.every((start, i) => {
      const text = nodes
        .slice(start + 1, starts[i + 1] ?? nodes.length)
        .flatMap((n) =>
          n.type === 'list' ? n.children.map((item) => toString(item)) : [toString(n)],
        )
        .join('\n');
      return /\bWHEN\b/.test(text) && /\bTHEN\b/.test(text);
    })
  );
}

export function safeOpenSpecPath(raw: string): string | null {
  const clean = raw.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!clean || clean.includes('\0') || clean.includes(':') || clean.startsWith('/')) return null;
  const parts = clean.split('/');
  if (parts.some((p) => p === '..' || p === '.' || !p || /[. ]$/.test(p))) return null;
  if (secretFile.test(clean)) return null;
  const at = parts.indexOf('openspec');
  if (at >= 0) return parts.slice(at).join('/');
  if (parts.length <= 2 && /^(spec|PRODUCT|DESIGN|tasks)\.md$/.test(parts.at(-1)!))
    return parts.at(-1)!;
  return null;
}

export function readOpenSpecFiles(input: Record<string, string>) {
  if (Object.keys(input).length > openspecLimits.files) throw new Error('OpenSpec: too many files');
  const files = new Map<string, string>();
  const diagnostics: OpenSpecDiagnostic[] = [];
  let total = 0;
  for (const [raw, text] of Object.entries(input)) {
    const bytes = new TextEncoder().encode(text).length;
    total += bytes;
    if (bytes > openspecLimits.fileBytes || total > openspecLimits.totalBytes)
      throw new Error('OpenSpec: file size limit exceeded');
    const path = safeOpenSpecPath(raw);
    if (!path) {
      diagnostics.push(
        diagnostic(
          'unsafe-path',
          raw,
          'Unsafe, secret or unsupported path.',
          'Chemin dangereux, secret ou non pris en charge.',
          'error',
        ),
      );
      continue;
    }
    if (files.has(path)) {
      diagnostics.push(
        diagnostic(
          'duplicate-path',
          raw,
          'Duplicate normalized path.',
          'Chemin normalisé en double.',
          'error',
        ),
      );
      continue;
    }
    files.set(path, text);
  }
  return { files, diagnostics };
}

/** Stable, namespaced identity; collisions are rejected by the import planner. */
export function openSpecId(prefix: string, key: string) {
  let a = 2166136261,
    b = 5381;
  for (const char of key) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ char.charCodeAt(0);
  }
  return `${prefix}-OS-${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}
