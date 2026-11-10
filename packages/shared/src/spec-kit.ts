/**
 * Spec-driven development workflow, after GitHub Spec Kit: the phases constitution → specify →
 * clarify → plan → checklist → tasks → analyze → implement → converge, mapped to SDD Studio
 * modules and views, and an export in the Spec Kit file layout (`.specify/`, `specs/NNN-name/`).
 */
import { completeness } from './completeness';
import { readiness } from './domain';
import { modules, moduleQuestions, t } from './templates';
import type { Localized } from './template-types';
import type { Spec } from './schema';

export type PhaseStatus = 'done' | 'active' | 'todo';
export type SddPhase = {
  id: string;
  command: string;
  title: Localized;
  summary: Localized;
  /** App view that carries out the phase. */
  view: 'specification' | 'readiness' | 'stack' | 'board' | 'traceability' | 'publishing' | 'import';
  modules: string[];
};

const L = (en: string, fr: string): Localized => ({ en, fr });
export const sddPhases: SddPhase[] = [
  { id: 'constitution', command: '/speckit.constitution', view: 'specification', modules: ['governance', 'conventions'], title: L('Constitution', 'Constitution'), summary: L('Principles, rules and conventions every change must respect.', 'Principes, règles et conventions que chaque changement respecte.') },
  { id: 'specify', command: '/speckit.specify', view: 'specification', modules: ['discovery', 'scope', 'workflows'], title: L('Specify', 'Spécifier'), summary: L('What to build and why: users, scope and workflows.', 'Quoi construire et pourquoi : utilisateurs, portée et parcours.') },
  { id: 'clarify', command: '/speckit.clarify', view: 'readiness', modules: [], title: L('Clarify', 'Clarifier'), summary: L('Resolve every answer marked unknown.', 'Résoudre chaque réponse marquée inconnue.') },
  { id: 'plan', command: '/speckit.plan', view: 'stack', modules: ['architecture', 'data', 'design', 'technology'], title: L('Plan', 'Planifier'), summary: L('Architecture, data, design and the technology stack.', 'Architecture, données, conception et pile technique.') },
  { id: 'checklist', command: '/speckit.checklist', view: 'readiness', modules: ['quality', 'security', 'testing'], title: L('Checklist', 'Liste de contrôle'), summary: L('Quality, security and test expectations are explicit.', 'Les attentes de qualité, de sécurité et de test sont explicites.') },
  { id: 'tasks', command: '/speckit.tasks', view: 'board', modules: [], title: L('Tasks', 'Tâches'), summary: L('Requirements exist and each one is covered by a test.', 'Les exigences existent et chacune est couverte par un test.') },
  { id: 'analyze', command: '/speckit.analyze', view: 'traceability', modules: [], title: L('Analyze', 'Analyser'), summary: L('Consistency across artifacts: no readiness blocker left.', 'Cohérence entre artefacts : aucun bloquant de préparation.') },
  { id: 'implement', command: '/speckit.implement', view: 'publishing', modules: ['delivery', 'operations'], title: L('Implement', 'Implémenter'), summary: L('Delivery and operations answered; publish the implementation bundle.', 'Livraison et exploitation renseignées ; publier le paquet d’implémentation.') },
  { id: 'converge', command: '/speckit.converge', view: 'import', modules: [], title: L('Converge', 'Converger'), summary: L('Import the repository back and review drift as proposals.', 'Réimporter le dépôt et réviser les écarts comme propositions.') },
];

/** Phase statuses: finished phases are done, the first unfinished one is active. */
export function phaseStatuses(spec: Spec): Record<string, PhaseStatus> {
  const c = completeness(spec);
  const r = readiness(spec);
  const modulesDone = (ids: string[]) =>
    ids.every((id) => {
      const m = c.perModule.find((x) => x.id === id);
      return !m || m.requiredDone === m.requiredTotal;
    });
  const done: Record<string, boolean> = {
    constitution: modulesDone(sddPhases[0].modules),
    specify: modulesDone(sddPhases[1].modules),
    clarify: r.unknown === 0 && c.perModule.every((m) => m.unknown === 0),
    plan: modulesDone(sddPhases[3].modules) && spec.stack.length > 0,
    checklist: modulesDone(sddPhases[4].modules),
    tasks: c.requirements > 0 && c.tested === c.requirements,
    analyze: r.ready,
    implement: r.ready && modulesDone(sddPhases[7].modules),
    converge: false,
  };
  let active = false;
  return Object.fromEntries(
    sddPhases.map((p) => {
      if (done[p.id]) return [p.id, 'done'];
      if (!active) {
        active = true;
        return [p.id, 'active'];
      }
      return [p.id, 'todo'];
    }),
  );
}

const slugify = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40) || 'feature';
const oneLine = (v: string) => v.replace(/\s*\n+\s*/g, ' ').trim();

/** Files of a Spec Kit workspace for the specification. `stack` holds technology names. */
export function specKitFiles(spec: Spec, stack: string[] = []): Record<string, string> {
  const fr = spec.language === 'fr';
  const lang = spec.language;
  const date = spec.updatedAt.slice(0, 10);
  const feature = `001-${slugify(spec.name)}`;
  const answered = (moduleId: string) => {
    const m = modules.find((x) => x.id === moduleId);
    const section = spec.sections.find((s) => s.id === moduleId);
    if (!m || !section) return [];
    return moduleQuestions(m, spec)
      .map((q) => ({ id: q.id, label: t(q.label, lang), answer: section.answers[q.id] }))
      .filter((q) => q.answer?.state === 'answered' && q.answer.value.trim())
      .map((q) => ({ id: q.id, label: q.label, value: q.answer!.value.trim() }));
  };
  const answer = (id: string) => answered(id.split('.')[0]).find((q) => q.id === id)?.value ?? '';
  const block = (moduleId: string) =>
    answered(moduleId)
      .map((q) => `### ${q.label}\n\n${q.value}`)
      .join('\n\n') || (fr ? '_Non renseigné._' : '_Not recorded._');
  const live = spec.items.filter((i) => i.status !== 'superseded');
  const of = (type: string) => live.filter((i) => i.type === type);
  const priority = { must: 'P1', should: 'P2', could: 'P3', wont: 'P4' } as const;
  const r = readiness(spec);
  const c = completeness(spec);
  const unknown = spec.sections.flatMap((s) =>
    Object.entries(s.answers)
      .filter(([, a]) => a.state === 'unknown')
      .map(([id, a]) => `- [NEEDS CLARIFICATION] ${id}${a.value ? ` — ${oneLine(a.value)}` : ''}`),
  );

  const constitution = `# ${spec.name} ${fr ? '— Constitution' : 'Constitution'}

## ${fr ? 'Principes et règles' : 'Core principles'}

${block('governance')}

## ${fr ? 'Conventions' : 'Conventions'}

${block('conventions')}

## ${fr ? 'Gouvernance' : 'Governance'}

${fr ? 'Cette constitution prime sur les autres pratiques. Toute modification passe par une proposition révisée dans SDD Studio.' : 'This constitution supersedes other practices. Amendments go through a reviewed proposal in SDD Studio.'}

**${fr ? 'Version' : 'Version'}**: r${spec.revision} | **${fr ? 'Ratifiée' : 'Ratified'}**: ${date}
`;

  const specMd = `# ${fr ? 'Spécification de fonctionnalité' : 'Feature Specification'}: ${spec.name}

**${fr ? 'Branche' : 'Feature Branch'}**: \`${feature}\`
**${fr ? 'Créée' : 'Created'}**: ${date}
**${fr ? 'État' : 'Status'}**: ${r.ready ? (fr ? 'Prête' : 'Ready') : fr ? 'Brouillon' : 'Draft'}
**${fr ? 'Entrée' : 'Input'}**: ${oneLine(spec.description) || spec.name}

## ${fr ? 'Scénarios utilisateur et tests' : 'User Scenarios & Testing'} *(${fr ? 'obligatoire' : 'mandatory'})*

${
  of('use-case')
    .map((u) => `### ${u.id}: ${u.title}${u.priority ? ` (${fr ? 'Priorité' : 'Priority'}: ${priority[u.priority]})` : ''}\n\n${u.body || '_—_'}${u.acceptance ? `\n\n**${fr ? 'Scénarios d’acceptation' : 'Acceptance Scenarios'}**:\n\n${u.acceptance}` : ''}`)
    .join('\n\n') || block('workflows')
}

## ${fr ? 'Exigences' : 'Requirements'} *(${fr ? 'obligatoire' : 'mandatory'})*

### ${fr ? 'Exigences fonctionnelles' : 'Functional Requirements'}

${of('requirement').map((q) => `- **${q.id}**: ${q.title}${q.priority ? ` _(${q.priority})_` : ''}`).join('\n') || (fr ? '_Aucune exigence._' : '_No requirements yet._')}

## ${fr ? 'Critères de réussite' : 'Success Criteria'} *(${fr ? 'obligatoire' : 'mandatory'})*

${of('requirement').filter((q) => q.acceptance).map((q) => `- **${q.id}**: ${oneLine(q.acceptance)}`).join('\n') || block('discovery')}

## ${fr ? 'Portée' : 'Scope'}

${block('scope')}

## ${fr ? 'Clarifications' : 'Clarifications'}

${unknown.join('\n') || (fr ? '- Aucune question ouverte.' : '- No open questions.')}
`;

  const plan = `# ${fr ? 'Plan d’implémentation' : 'Implementation Plan'}: ${spec.name}

**${fr ? 'Branche' : 'Branch'}**: \`${feature}\` | **${fr ? 'Date' : 'Date'}**: ${date} | **Spec**: [spec.md](./spec.md)

## ${fr ? 'Contexte technique' : 'Technical Context'}

${stack.length ? stack.map((s) => `- ${s}`).join('\n') : fr ? '_Aucune technologie choisie._' : '_No technology chosen yet._'}

## ${fr ? 'Vérification de la constitution' : 'Constitution Check'}

${r.blockers.length ? r.blockers.map((b) => `- [ ] ${b}`).join('\n') : fr ? '- [x] Aucun bloquant.' : '- [x] No blockers.'}

## ${fr ? 'Architecture' : 'Architecture'}

${block('architecture')}

## ${fr ? 'Modèle de données' : 'Data model'}

${block('data')}

## ${fr ? 'Composants' : 'Components'}

${of('component').map((x) => `- **${x.id}**: ${x.title}`).join('\n') || '_—_'}
`;

  const research = `# ${fr ? 'Recherche et décisions' : 'Research & Decisions'}: ${spec.name}

${of('decision').map((d) => `## ${d.id}: ${d.title}\n\n**${fr ? 'État' : 'Status'}**: ${d.status}\n\n${d.body || '_—_'}`).join('\n\n') || (fr ? '_Aucune décision._' : '_No decisions recorded._')}
`;

  let n = 0;
  const task = (text: string, parallel = false) => `- [ ] T${String(++n).padStart(3, '0')}${parallel ? ' [P]' : ''} ${text}`;
  const tasks = `# ${fr ? 'Tâches' : 'Tasks'}: ${spec.name}

**${fr ? 'Entrée' : 'Input'}**: [plan.md](./plan.md), [spec.md](./spec.md)
${fr ? '`[P]` : peut être fait en parallèle.' : '`[P]`: can run in parallel.'}

## ${fr ? 'Phase 1 : mise en place' : 'Phase 1: Setup'}

${[task(fr ? 'Initialiser le dépôt selon plan.md et la constitution' : 'Initialise the repository per plan.md and the constitution'), ...stack.map((s) => task(`${fr ? 'Configurer' : 'Configure'} ${s}`, true))].join('\n')}

## ${fr ? 'Phase 2 : tests d’abord' : 'Phase 2: Tests first'}

${of('test').map((x) => task(`${x.id} ${x.title}`, true)).join('\n') || task(fr ? 'Écrire les tests d’acceptation de spec.md' : 'Write the acceptance tests from spec.md')}

## ${fr ? 'Phase 3 : implémentation' : 'Phase 3: Core implementation'}

${[...of('use-case'), ...of('requirement')].map((x) => task(`${x.id} ${x.title}`)).join('\n') || task(fr ? 'Implémenter les exigences' : 'Implement the requirements')}

## ${fr ? 'Phase 4 : finition' : 'Phase 4: Polish'}

${[task(fr ? 'Mettre à jour la documentation et la spécification (convergence)' : 'Update documentation and converge the specification'), task(fr ? 'Vérifier les critères de réussite' : 'Verify the success criteria')].join('\n')}
`;

  const checklist = `# ${fr ? 'Liste de contrôle de la spécification' : 'Specification Quality Checklist'}: ${spec.name}

**${fr ? 'Objet' : 'Purpose'}**: ${fr ? 'Valider la complétude avant la planification.' : 'Validate completeness before planning.'}
**${fr ? 'Complétude' : 'Completeness'}**: ${c.percent}% · **${fr ? 'Préparation' : 'Readiness'}**: ${r.percent}%

## ${fr ? 'Modules' : 'Modules'}

${c.perModule
  .map((m) => {
    const title = t(modules.find((x) => x.id === m.id)!.title, lang);
    return `- [${m.requiredDone === m.requiredTotal ? 'x' : ' '}] ${title} — ${m.requiredDone}/${m.requiredTotal}`;
  })
  .join('\n')}

## ${fr ? 'Bloquants' : 'Blockers'}

${r.blockers.map((b) => `- [ ] ${b}`).join('\n') || (fr ? '- [x] Aucun' : '- [x] None')}
`;

  const files: Record<string, string> = {
    '.specify/memory/constitution.md': constitution,
    [`specs/${feature}/spec.md`]: specMd,
    [`specs/${feature}/plan.md`]: plan,
    [`specs/${feature}/research.md`]: research,
    [`specs/${feature}/tasks.md`]: tasks,
    [`specs/${feature}/checklists/requirements.md`]: checklist,
  };
  if (/roadmap|feuille de route/i.test(answer('governance.13'))) {
    const depends = (id: string) => spec.links.filter((l) => l.kind === 'depends-on' && l.from === id).map((l) => l.to).join(', ') || '—';
    files['specs/roadmap.md'] = `# ${fr ? 'Feuille de route' : 'Roadmap'}: ${spec.name}

| ID | ${fr ? 'Sous-fonctionnalité' : 'Sub-feature'} | ${fr ? 'Intention' : 'Intent'} | ${fr ? 'Limite de portée' : 'Scope boundary'} | ${fr ? 'Dépend de' : 'Depends on'} | ${fr ? 'État' : 'Status'} | ${fr ? 'Sous-spécification' : 'Sub-spec'} |
| --- | --- | --- | --- | --- | --- | --- |
${of('use-case')
  .map((u, i) => `| ${u.id} | ${u.title.replace(/\|/g, '\\|')} | ${oneLine(u.body).slice(0, 120).replace(/\|/g, '\\|') || '—'} | ${oneLine(u.acceptance).slice(0, 80).replace(/\|/g, '\\|') || '—'} | ${depends(u.id)} | ${u.status} | \`specs/${String(i + 2).padStart(3, '0')}-${slugify(u.title)}/\` |`)
  .join('\n')}
`;
  }
  return files;
}
