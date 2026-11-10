import type { Spec } from './schema';
import { describeIssue, readiness, upstreamOf, downstreamOf } from './domain';
import { findQuestion, t } from './templates';

const cell = (v: string) => v.replaceAll('|', '\\|').replaceAll('\n', ' ');

/** Requirement-centred matrix: what satisfies, implements, tests and decides each item. */
export function traceabilityMatrix(spec: Spec) {
  if (!spec.items.length) return '_No traceable items yet._';
  const rows = spec.items.map((item) => {
    const up = spec.links.filter((l) => downstreamOf(l) === item.id).map((l) => `${l.kind} ${upstreamOf(l)}`);
    const down = spec.links.filter((l) => upstreamOf(l) === item.id).map((l) => `${downstreamOf(l)} ${l.kind}`);
    return `| ${item.id} | ${item.type} | ${cell(item.title)} | ${item.status}${item.needsReview ? ' ⚠' : ''} | ${cell(up.join(', ') || '—')} | ${cell(down.join(', ') || '—')} |`;
  });
  return [
    '| ID | Type | Title | Status | Depends on | Referenced by |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

const readme = `# Specification records (.plan)

This folder is generated from an SDD Studio specification and kept in the repository so people and coding agents share one source of truth.

| Path | Purpose |
| --- | --- |
| \`specification.json\` | Canonical, lossless bundle (\`format: sdd-studio\`, \`version: 1\`). Import it into SDD Studio to review changes. |
| \`manifest.json\` | Revision, generation time and SHA-256 of every exported file. |
| \`spec/NN-<module>.md\` | One document per specification module. Answer blocks (\`<!-- sdd:answer … -->\`) mirror structured answers. |
| \`diagrams/<module>.mmd\` | Mermaid source for module diagrams. |
| \`decisions/ADR-###.md\` | Architecture decision records. |
| \`traceability.md\` | Links between requirements, use cases, decisions, components, risks and tests. |
| \`readiness.md\` | Readiness blockers and warnings at export time. |
| \`plan.md\` | Scope and delivery plan. |
| \`tasks.md\` | Implementation tasks with requirement and test identifiers. |
| \`backlog.md\` | Open questions, unresolved decisions and deferred work. |
| \`designs.md\` | Design and architecture decisions. |
| \`changes.md\` | Chronological change record. |

## Rules

- Read \`plan.md\`, \`tasks.md\`, \`backlog.md\`, \`designs.md\` and \`changes.md\` before implementation.
- Update every affected record in the same change. Preserve identifiers.
- Edits to \`spec/\` documents are imported into SDD Studio as proposals and reviewed before they become part of the specification. Never edit \`specification.json\` by hand.
`;

export function planFiles(spec: Spec): Record<string, string> {
  const lang = spec.language;
  const section = (id: string) => spec.sections.find((s) => s.id === id);
  const answer = (id: string) => {
    const a = section(id.split('.')[0])?.answers[id];
    return a?.state === 'answered' ? a.value : '';
  };
  const r = readiness(spec);
  const unknown = spec.sections.flatMap((s) =>
    Object.entries(s.answers)
      .filter(([, a]) => a.state === 'unknown')
      .map(([id, a]) => `- **${id}** ${t(findQuestion(id)?.label ?? { en: id, fr: id }, lang)}${a.value ? ` — ${a.value.replace(/\n+/g, ' ')}` : ''}`),
  );
  return {
    '.plan/README.md': readme,
    '.plan/plan.md': `# ${spec.name}\n\n${spec.description}\n\nProject type: ${spec.projectType}. Specification revision ${spec.revision}.\n\n## Scope\n\n${answer('scope.1') || '_See spec/02-scope.md._'}\n\n## Out of scope\n\n${answer('scope.2') || '_Not recorded._'}\n\n## Milestones\n\n${answer('scope.7') || answer('governance.3') || '_Not recorded._'}\n`,
    '.plan/tasks.md': `# Tasks\n\nStatus: \`[ ]\` not started. Specification status is not implementation status; verify each task separately.\n\n${
      spec.items
        .filter((i) => ['requirement', 'use-case', 'test'].includes(i.type) && i.status !== 'superseded')
        .map((i) => {
          const tests = spec.links.filter((l) => l.kind === 'tests' && l.to === i.id).map((l) => l.from);
          return `- [ ] ${i.id}: ${i.title}${i.priority ? ` (${i.priority})` : ''}${tests.length ? ` — verified by ${tests.join(', ')}` : ''}`;
        })
        .join('\n') || '_No traceable items yet._'
    }\n${answer('governance.6') ? `\n## Planned implementation tasks\n\n${answer('governance.6')}\n` : ''}`,
    '.plan/backlog.md': `# Open questions and backlog\n\n## Readiness blockers\n\n${r.issues
      .filter((i) => i.severity === 'blocker')
      .map((i) => `- ${describeIssue(i, lang)}`)
      .join('\n') || '- None'}\n\n## Unknown answers\n\n${unknown.join('\n') || '- None'}\n\n## Unresolved decisions\n\n${answer('governance.4') || '_Not recorded._'}\n`,
    '.plan/designs.md': `# Design decisions\n\n${
      spec.items
        .filter((i) => i.type === 'decision')
        .map((i) => `## ${i.id}: ${i.title}\n\nStatus: ${i.status}\n\n${i.body}`)
        .join('\n\n') || '_No decisions recorded._'
    }\n`,
    '.plan/changes.md': `# Specification change record\n\n## Revision ${spec.revision}\n\n- Updated: ${spec.updatedAt}\n- Author: ${spec.updatedBy}\n\nThis bundle is a revision snapshot. When integrating it into an existing repository, keep earlier entries and record implementation changes here.\n`,
  };
}
