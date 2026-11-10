import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { encode } from '@toon-format/toon';
import { planFiles, traceabilityMatrix } from '../../../packages/shared/src/plan-files';
import { designMarkdown, productMarkdown } from '../../../packages/shared/src/agent-docs';
import { securityChecklistMarkdown } from '../../../packages/shared/src/security-checklist';
import { readiness } from '../../../packages/shared/src/domain';
import { modules, t } from '../../../packages/shared/src/templates';
import { languagesForStack, layoutMarkdown, namingMarkdown } from '../../../packages/shared/src/conventions';
import { slugOf } from '../../../packages/shared/src/stack';
import { completeness } from '../../../packages/shared/src/completeness';
import { htmlDocument, latexDocument, type RenderedDocument } from '../../../packages/shared/src/document-render';
import { overviewSvg } from '../../../packages/shared/src/overview-image';
import { specKitFiles } from '../../../packages/shared/src/spec-kit';
import { openSpecFiles } from '../../../packages/shared/src/openspec-export';
import { stripAnswerMarkers } from '../../../packages/shared/src/markdown';
import { maintainSkill, skillFiles } from './skill-export';
import type { Spec, Technology } from '../../../packages/shared/src/schema';
import type { Card } from '../../../packages/shared/src/board';
import { boardPlanFiles } from '../../../packages/shared/src/plan-folder';

export const exportFormats = ['json', 'markdown', 'xml', 'toon', 'latex', 'html', 'svg', 'pdf', 'zip', 'speckit', 'openspec', 'skill', 'agents'] as const;
export type ExportFormat = (typeof exportFormats)[number];
const extension: Record<ExportFormat, string> = {
  json: 'json',
  markdown: 'md',
  xml: 'xml',
  toon: 'toon',
  latex: 'tex',
  html: 'html',
  svg: 'svg',
  pdf: 'pdf',
  zip: 'zip',
  speckit: 'speckit.zip',
  openspec: 'openspec.zip',
  skill: 'skill.zip',
  agents: 'agents.zip',
};
export const exportMime: Record<ExportFormat, string> = {
  json: 'application/json',
  markdown: 'text/markdown; charset=utf-8',
  xml: 'application/xml',
  toon: 'text/plain; charset=utf-8',
  latex: 'application/x-tex; charset=utf-8',
  html: 'text/html; charset=utf-8',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  speckit: 'application/zip',
  openspec: 'application/zip',
  skill: 'application/zip',
  agents: 'application/zip',
};
const slug = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'specification';
export const fileName = (spec: Spec, format: ExportFormat, label: string) =>
  `${slug(spec.name)}-${label}.${extension[format]}`;

export function bundle(spec: Spec, technologies: Technology[] = []) {
  return { format: 'sdd-studio' as const, version: 1 as const, spec, technologies };
}
export async function openSpecZip(spec: Spec, cards: Card[] = []) {
  const { files } = openSpecFiles(spec, cards);
  files['spec.md'] = markdownDocument(spec);
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
const xmlEscape = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    // XML 1.0 forbids most control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function xml(v: unknown): string {
  if (v === null || v === undefined) return '<null/>';
  if (Array.isArray(v)) return `<array>${v.map((x) => `<item>${xml(x)}</item>`).join('')}</array>`;
  if (typeof v === 'object')
    return `<object>${Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `<field name="${xmlEscape(k)}">${xml(x)}</field>`)
      .join('')}</object>`;
  return `<${typeof v}>${xmlEscape(String(v))}</${typeof v}>`;
}
export function markdownDocument(spec: Spec) {
  const lang = spec.language;
  const r = readiness(spec);
  return [
    `# ${spec.name}`,
    `| | |\n| --- | --- |\n| ${lang === 'fr' ? 'Révision' : 'Revision'} | ${spec.revision} |\n| ${lang === 'fr' ? 'Type de projet' : 'Project type'} | ${spec.projectType} |\n| ${lang === 'fr' ? 'Mis à jour' : 'Updated'} | ${spec.updatedAt} |\n| ${lang === 'fr' ? 'Préparation' : 'Readiness'} | ${r.percent}% ${r.ready ? '✔' : ''} |`,
    spec.description,
    `## ${lang === 'fr' ? 'Sommaire' : 'Contents'}\n\n${modules.map((m, i) => `${i + 1}. ${t(m.title, lang)}`).join('\n')}`,
    ...spec.sections.map((s) => {
      const body = stripAnswerMarkers(s.markdown).replace(/^# /m, `# ${modules.findIndex((m) => m.id === s.id) + 1}. `);
      const diagram = s.diagram ? `\n\n\`\`\`mermaid\n${s.diagram}\n\`\`\`` : '';
      const refs = s.references.length
        ? `\n\n**${lang === 'fr' ? 'Références' : 'References'}:** ${s.references.map((x) => `[${x.title}](${x.url})`).join(', ')}`
        : '';
      return body + diagram + refs;
    }),
    `## ${lang === 'fr' ? 'Traçabilité' : 'Traceability'}\n\n${traceabilityMatrix(spec)}`,
  ].join('\n\n---\n\n');
}

export function serialize(spec: Spec, format: string, technologies: Technology[] = []) {
  const b = bundle(spec, technologies);
  if (format === 'json') return JSON.stringify(b, null, 2);
  if (format === 'xml')
    return `<?xml version="1.0" encoding="UTF-8"?><sdd-studio version="1">${xml(b)}</sdd-studio>`;
  if (format === 'toon') return encode(b);
  if (format === 'markdown') return markdownDocument(spec);
  if (format === 'latex') return latexDocument(renderedDocument(spec));
  if (format === 'html') return htmlDocument(renderedDocument(spec));
  if (format === 'svg') return overviewImage(spec, technologies);
  throw new Error('Unsupported export format');
}

/** The specification as titled chapters, shared by the LaTeX and HTML renderers. */
export function renderedDocument(spec: Spec): RenderedDocument {
  const fr = spec.language === 'fr';
  const r = readiness(spec);
  const chapters = spec.sections.map((s) => {
    const m = modules.find((x) => x.id === s.id);
    const diagram = s.diagram ? `\n\n\`\`\`mermaid\n${s.diagram}\n\`\`\`` : '';
    const refs = s.references.length
      ? `\n\n## ${fr ? 'Références' : 'References'}\n\n${s.references.map((x) => `- [${x.title}](${x.url})`).join('\n')}`
      : '';
    return { id: s.id, title: m ? t(m.title, spec.language) : s.id, markdown: stripAnswerMarkers(s.markdown) + diagram + refs };
  });
  chapters.push({ id: 'traceability', title: fr ? 'Traçabilité' : 'Traceability', markdown: traceabilityMatrix(spec) });
  return {
    title: spec.name,
    subtitle: spec.description.split('\n')[0]?.slice(0, 200) || undefined,
    language: spec.language,
    meta: [
      [fr ? 'Révision' : 'Revision', String(spec.revision)],
      [fr ? 'Type de projet' : 'Project type', spec.projectType],
      [fr ? 'Mis à jour' : 'Updated', spec.updatedAt.slice(0, 10)],
      [fr ? 'Préparation' : 'Readiness', `${r.percent}%${r.ready ? (fr ? ' (prêt)' : ' (ready)') : ''}`],
    ],
    chapters,
  };
}

const stackNames = (spec: Spec, technologies: Technology[]) =>
  spec.stack.map((e) => technologies.find((x) => x.id === e.technologyId)?.name).filter((n): n is string => !!n);

/** A 1200×630 SVG overview card (readiness, completeness per module, stack). */
export function overviewImage(spec: Spec, technologies: Technology[] = []) {
  const c = completeness(spec);
  const r = readiness(spec);
  return overviewSvg({
    name: spec.name,
    subtitle: `${spec.projectType} · r${spec.revision} · ${spec.updatedAt.slice(0, 10)}`,
    language: spec.language,
    readiness: r.percent,
    ready: r.ready,
    completeness: c.percent,
    modules: c.perModule.map((m) => ({
      title: t(modules.find((x) => x.id === m.id)!.title, spec.language),
      done: m.requiredDone,
      total: m.requiredTotal,
    })),
    stack: stackNames(spec, technologies),
  });
}

export async function specKitZip(spec: Spec, technologies: Technology[] = []) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(specKitFiles(spec, stackNames(spec, technologies)))) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const answerText = (spec: Spec, questionId: string) => {
  const a = spec.sections.find((s) => s.id === questionId.split('.')[0])?.answers[questionId];
  return a?.state === 'answered' ? a.value.trim() : '';
};
function agentInstructions(spec: Spec, audience: string) {
  const projectRules = answerText(spec, 'governance.7');
  const conventions = ['conventions.1', 'conventions.2', 'conventions.4']
    .map((id) => answerText(spec, id))
    .filter(Boolean);
  const open = readiness(spec).blockers.length;
  return `# ${spec.name} — ${audience}

This repository is built from an SDD Studio specification (revision ${spec.revision}).

## Before you change code
1. Read \`.plan/README.md\`, then the relevant documents in \`.plan/spec/\`.
2. Find the requirement (REQ-), use case (UC-), decision (ADR-), component (CMP-), risk (RISK-) and test (TEST-) identifiers your change touches in \`.plan/traceability.md\`.

## Always
- Preserve every stable identifier. Never renumber, reuse or delete identifiers; mark superseded items instead.
- Link new tests to the requirements they verify and keep \`.plan/tasks.md\` and \`.plan/changes.md\` current.
- Update every affected specification document in the same change, and explain the dependency.

## Never
- Never edit an approved baseline or \`.plan/specification.json\` by hand; propose changes through SDD Studio review.
- Never guess an unresolved decision. Report it (there ${open === 1 ? 'is 1 open item' : `are ${open} open items`} in \`.plan/backlog.md\`).
${projectRules ? `\n## Project rules\n\n${projectRules}\n` : ''}${conventions.length ? `\n## Conventions\n\n${conventions.map((c) => `- ${c.replace(/\n+/g, ' ')}`).join('\n')}\n` : ''}`;
}
/** Files of the implementation bundle, shared by the zip download and Git publishing. */
export function implementationFiles(spec: Spec, technologies: Technology[] = []): Record<string, string> {
  const files: Record<string, string> = { ...planFiles(spec) };
  files['.plan/specification.json'] = serialize(spec, 'json', technologies);
  files['.plan/specification.toon'] = serialize(spec, 'toon', technologies);
  for (const [i, s] of spec.sections.entries()) {
    files[`.plan/spec/${String(i + 1).padStart(2, '0')}-${s.id}.md`] = s.markdown;
    if (s.diagram) files[`.plan/diagrams/${s.id}.mmd`] = s.diagram;
  }
  for (const d of spec.items.filter((i) => i.type === 'decision'))
    files[`.plan/decisions/${d.id}.md`] =
      `# ${d.id}: ${d.title}\n\nStatus: ${d.status}${d.needsReview ? ' (needs review)' : ''}\n\n${d.body}\n`;
  files['.plan/traceability.md'] = `# Traceability\n\n${traceabilityMatrix(spec)}\n`;
  files['.plan/security-checklist.md'] = securityChecklistMarkdown(spec);
  const languages = languagesForStack(
    spec.stack.map((e) => technologies.find((t) => t.id === e.technologyId)).filter((t): t is Technology => !!t).map(slugOf),
  );
  if (languages.length) {
    const fr = spec.language === 'fr';
    files['.plan/conventions.md'] =
      `# ${fr ? 'Conventions de nommage et de dossiers' : 'Naming and folder conventions'}\n\n${namingMarkdown(languages, spec.language)}\n\n## ${fr ? 'Structure des dossiers' : 'Folder structure'}\n\n${layoutMarkdown(languages, spec.language)}\n`;
  }
  const r = readiness(spec);
  files['.plan/readiness.md'] =
    `# Readiness\n\n${r.percent}% of required answers complete (${r.complete}/${r.total}). ${r.ready ? 'Ready for baseline.' : 'Not ready.'}\n\n## Blockers\n\n${r.blockers.map((b) => `- ${b}`).join('\n') || '- None'}\n\n## Warnings\n\n${r.warnings.map((w) => `- ${w}`).join('\n') || '- None'}\n`;
  files['PRODUCT.md'] = productMarkdown(spec);
  files['DESIGN.md'] = designMarkdown(spec);
  files['spec.md'] = markdownDocument(spec);
  files['AGENTS.md'] = agentInstructions(spec, 'agent instructions');
  files['CLAUDE.md'] = agentInstructions(spec, 'Claude Code instructions');
  files['.github/copilot-instructions.md'] = agentInstructions(spec, 'Copilot instructions');
  files['.claude/skills/maintain-spec/SKILL.md'] = maintainSkill;
  const manifest = {
    format: 'sdd-studio',
    version: 1,
    projectId: spec.id,
    revision: spec.revision,
    generatedAt: new Date().toISOString(),
    files: Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') })),
  };
  files['.plan/manifest.json'] = JSON.stringify(manifest, null, 2);
  return files;
}

export async function implementationZip(spec: Spec, technologies: Technology[] = []) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(implementationFiles(spec, technologies))) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Every `.plan/` file for a project: the implementation bundle's plan files plus the live board. Pure, so fixtures can pin `generatedAt`. */
export function planFolderFiles(spec: Spec, technologies: Technology[], cards: Card[], generatedAt = new Date().toISOString()): Record<string, string> {
  const files = Object.fromEntries(Object.entries(implementationFiles(spec, technologies)).filter(([path]) => path.startsWith('.plan/') && path !== '.plan/manifest.json'));
  if (cards.length) Object.assign(files, boardPlanFiles(cards, `${spec.name} — tasks`));
  const manifest = {
    format: 'sdd-studio-plan',
    version: 1,
    projectId: spec.id,
    revision: spec.revision,
    boardCards: cards.length,
    generatedAt,
    files: Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') })),
  };
  files['.plan/manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return files;
}

/**
 * Agent instruction files for the tools teams use, all pointing at the same specification:
 * AGENTS.md (agents.md convention: Codex, Jules, Amp…), CLAUDE.md, GEMINI.md, GitHub Copilot and a
 * Cursor project rule, plus PRODUCT.md and DESIGN.md and the maintenance skill.
 */
export function agentFiles(spec: Spec): Record<string, string> {
  const shared = agentInstructions(spec, 'agent instructions');
  return {
    'AGENTS.md': shared,
    'CLAUDE.md': `@AGENTS.md\n\nRead PRODUCT.md and DESIGN.md before planning a change. The maintain-spec skill keeps .plan/ in step.\n`,
    'GEMINI.md': agentInstructions(spec, 'Gemini CLI instructions'),
    '.github/copilot-instructions.md': agentInstructions(spec, 'Copilot instructions'),
    '.cursor/rules/specification.mdc': `---\ndescription: ${spec.name} specification rules (SDD Studio)\nalwaysApply: true\n---\n\n${shared}`,
    'PRODUCT.md': productMarkdown(spec),
    'DESIGN.md': designMarkdown(spec),
    '.claude/skills/maintain-spec/SKILL.md': maintainSkill,
  };
}

async function zipOf(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
export { skillFiles };
export const skillZip = (spec: Spec) => zipOf(skillFiles(spec));
export const agentsZip = (spec: Spec) => zipOf(agentFiles(spec));

