import { stackLayers, type Item, type Spec, type StackLayer } from './schema';
import { cardSchema, type Card } from './board';

/**
 * Splits an approved specification into an ordered task plan. It is a pure function of the
 * specification, not a model: the same baseline always gives the same tasks, and every task says
 * which items it comes from.
 *
 *  - Foundations: one task per stack layer that has technologies chosen.
 *  - Decisions: one task per decision, before the work they steer.
 *  - Epics: one per component. Its requirements follow in priority order, each with the tests that
 *    verify it (a test task is added when a requirement has none); the component's own task comes
 *    last, because the component is done when its requirements are.
 *  - Requirements no component implements, use cases (each waits for its requirements), risk
 *    mitigations and tests that verify nothing come after.
 *  - "Won't" items go to the backlog. Dependencies come from the structure above and from the
 *    specification's own depends-on links; one that would form a loop is dropped and reported.
 *
 * Every item keeps its identifier as the card identifier, so a board that already exists keeps its
 * columns, assignees and pull requests when it is refreshed; only grouping, order and dependencies
 * change. Derived tasks (SETUP-nn and REQ-nnn.tests) have identifiers of their own.
 */
export type TaskPlan = {
  cards: Card[];
  /** Findings the plan could not fix: the specification should change. */
  gaps: string[];
  summary: {
    tasks: number;
    epics: number;
    foundations: number;
    derivedTests: number;
    backlog: number;
  };
};
export type TaskPlanOptions = {
  /** Names of the technologies chosen per stack layer. */
  stack?: Partial<Record<StackLayer, string[]>>;
};

const maxCards = 2000;
const maxGaps = 100;
const layerLabels: Record<StackLayer, { en: string; fr: string }> = {
  frontend: { en: 'the frontend', fr: 'l’interface (frontend)' },
  backend: { en: 'the backend', fr: 'le serveur (backend)' },
  mobile: { en: 'the mobile app', fr: 'l’application mobile' },
  desktop: { en: 'the desktop app', fr: 'l’application de bureau' },
  data: { en: 'data storage', fr: 'le stockage des données' },
  communication: { en: 'communication', fr: 'la communication' },
  contracts: { en: 'API contracts', fr: 'les contrats d’API' },
  infrastructure: { en: 'infrastructure', fr: 'l’infrastructure' },
  iac: { en: 'infrastructure as code', fr: 'l’infrastructure as code' },
  cicd: { en: 'CI/CD', fr: 'la CI/CD' },
  testing: { en: 'testing tools', fr: 'les outils de test' },
  observability: { en: 'observability', fr: 'l’observabilité' },
  ai: { en: 'AI', fr: 'l’IA' },
  development: { en: 'developer tooling', fr: 'les outils de développement' },
};
const priorityRank: Record<string, number> = { must: 0, should: 1, could: 2, wont: 4 };

export function breakIntoTasks(spec: Spec, options: TaskPlanOptions = {}): TaskPlan {
  const fr = spec.language === 'fr';
  const t = (en: string, french: string) => (fr ? french : en);
  const items = spec.items.filter((i) => i.status !== 'superseded');
  const known = new Set(items.map((i) => i.id));
  const ofType = (type: Item['type']) => items.filter((i) => i.type === type);
  const links = spec.links.filter((l) => known.has(l.from) && known.has(l.to));
  const connected = (a: string, b: string, kinds: readonly string[]) =>
    links.some(
      (l) =>
        kinds.includes(l.kind) && ((l.from === a && l.to === b) || (l.from === b && l.to === a)),
    );
  const gaps: string[] = [];
  let dropped = 0;
  const gap = (message: string) => void (gaps.length < maxGaps ? gaps.push(message) : dropped++);

  const groups = {
    foundations: t('Foundations', 'Mise en place'),
    decisions: t('Decisions', 'Décisions'),
    unassigned: t('Requirements without a component', 'Exigences sans composant'),
    useCases: t('Use cases', 'Cas d’utilisation'),
    risks: t('Risk mitigations', 'Mesures contre les risques'),
    verification: t('Verification', 'Vérification'),
  };
  const cards: Card[] = [];
  const placed = new Set<string>();
  const push = (card: Card) => {
    if (placed.has(card.id) || cards.length >= maxCards) return false;
    placed.add(card.id);
    cards.push(card);
    return true;
  };
  const cardOf = (item: Item, group: string) => {
    const related = spec.links
      .filter((l) => l.from === item.id || l.to === item.id)
      .map((l) => (l.from === item.id ? l.to : l.from));
    return cardSchema.parse({
      id: item.id,
      title: item.title,
      body: item.acceptance || item.body.slice(0, 5000),
      column: item.priority === 'wont' ? 'backlog' : 'todo',
      group,
      sourceIds: [item.id, ...new Set(related)].slice(0, 50),
      assignee: item.owner,
    });
  };

  // Dependencies are collected as edges and checked for loops as they are added.
  const edges = new Map<string, Set<string>>();
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return [...(edges.get(from) ?? [])].some((next) => reaches(next, to, seen));
  };
  const dependOn = (card: string, needs: string) => {
    if (card === needs || edges.get(card)?.has(needs)) return;
    if (reaches(needs, card))
      return gap(
        t(
          `${card} and ${needs} depend on each other; the dependency of ${card} on ${needs} was ignored.`,
          `${card} et ${needs} dépendent l’un de l’autre ; la dépendance de ${card} envers ${needs} a été ignorée.`,
        ),
      );
    edges.set(card, (edges.get(card) ?? new Set()).add(needs));
  };

  // Foundations
  let foundations = 0;
  for (const [index, layer] of stackLayers.entries()) {
    const names = (options.stack?.[layer] ?? []).filter(Boolean);
    if (!names.length) continue;
    const card = cardSchema.parse({
      id: `SETUP-${String(index + 1).padStart(2, '0')}`,
      title: t(
        `Set up ${layerLabels[layer].en}: ${names.slice(0, 6).join(', ')}`,
        `Mettre en place ${layerLabels[layer].fr} : ${names.slice(0, 6).join(', ')}`,
      ).slice(0, 500),
      body: t(
        'Install, configure and document it so the work below can start.',
        'L’installer, la configurer et la documenter pour que le travail ci-dessous puisse commencer.',
      ),
      column: 'todo',
      group: groups.foundations,
      sourceIds: [`stack:${layer}`],
    });
    if (push(card)) foundations++;
  }

  // Decisions steer the work, so they come first; a draft one blocks what it decides.
  const decisions = ofType('decision');
  for (const decision of decisions) push(cardOf(decision, groups.decisions));

  // Requirements belong to the first component that implements them.
  const components = ofType('component');
  const requirements = ofType('requirement');
  const tests = ofType('test');
  const implementing = (req: Item) =>
    components.find((c) => connected(c.id, req.id, ['implements', 'satisfies', 'refines']));
  const byPriority = (list: Item[]) =>
    [...list].sort(
      (a, b) => (priorityRank[a.priority ?? ''] ?? 3) - (priorityRank[b.priority ?? ''] ?? 3),
    );
  let derivedTests = 0;
  const withTests = (req: Item, group: string) => {
    const mine = tests.filter((x) =>
      links.some((l) => l.kind === 'tests' && l.from === x.id && l.to === req.id),
    );
    for (const test of mine) push(cardOf(test, group));
    if (!req.acceptance.trim())
      gap(
        t(
          `${req.id} has no acceptance criteria, so nothing says what its tests must check.`,
          `${req.id} n’a pas de critères d’acceptation : rien ne dit ce que ses tests doivent vérifier.`,
        ),
      );
    if (mine.length || req.priority === 'wont') return;
    const id = `${req.id}.tests`;
    if (known.has(id)) return;
    const added = push(
      cardSchema.parse({
        id,
        title: t(
          `Write tests for ${req.id}: ${req.title}`,
          `Écrire les tests de ${req.id} : ${req.title}`,
        ).slice(0, 500),
        body:
          req.acceptance ||
          t(
            'Cover the requirement with automated tests.',
            'Couvrir l’exigence par des tests automatisés.',
          ),
        column: 'todo',
        group,
        sourceIds: [req.id],
      }),
    );
    if (added) {
      derivedTests++;
      dependOn(id, req.id);
    }
  };

  let epics = 0;
  const assigned = new Set<string>();
  for (const component of components) {
    const own = byPriority(requirements.filter((r) => implementing(r)?.id === component.id));
    const group = `${component.id} ${component.title}`.slice(0, 200);
    epics++;
    if (!own.length)
      gap(
        t(
          `${component.id} implements no requirement.`,
          `${component.id} n’implémente aucune exigence.`,
        ),
      );
    for (const req of own) {
      assigned.add(req.id);
      push(cardOf(req, group));
      withTests(req, group);
    }
    push(cardOf(component, group));
    for (const req of own) dependOn(component.id, req.id);
    for (const decision of decisions)
      if (decision.status === 'draft' && connected(decision.id, component.id, ['decides']))
        dependOn(component.id, decision.id);
  }
  for (const req of byPriority(requirements.filter((r) => !assigned.has(r.id)))) {
    gap(
      t(
        `${req.id} is not implemented by any component.`,
        `${req.id} n’est implémentée par aucun composant.`,
      ),
    );
    push(cardOf(req, groups.unassigned));
    withTests(req, groups.unassigned);
  }

  for (const useCase of ofType('use-case')) {
    push(cardOf(useCase, groups.useCases));
    const needed = requirements.filter((r) =>
      connected(useCase.id, r.id, ['satisfies', 'refines', 'implements']),
    );
    if (!needed.length)
      gap(
        t(
          `${useCase.id} is satisfied by no requirement.`,
          `${useCase.id} n’est satisfait par aucune exigence.`,
        ),
      );
    for (const req of needed) dependOn(useCase.id, req.id);
  }
  for (const risk of ofType('risk')) push(cardOf(risk, groups.risks));
  for (const test of tests) push(cardOf(test, groups.verification));

  // The specification's own depends-on links, last so that the structure above wins in a conflict.
  for (const link of links)
    if (link.kind === 'depends-on' && placed.has(link.from) && placed.has(link.to))
      dependOn(link.from, link.to);
  if (dropped) gaps.push(t(`…and ${dropped} more.`, `…et ${dropped} autres.`));
  // The most important finding comes first.
  if (cards.length >= maxCards)
    gaps.unshift(
      t(
        `The plan holds more than ${maxCards} tasks; only the first ${maxCards} were created.`,
        `Le plan dépasse ${maxCards} tâches ; seules les ${maxCards} premières ont été créées.`,
      ),
    );

  const planned = cards.map((card) => ({
    ...card,
    dependsOn: [...(edges.get(card.id) ?? [])].filter((id) => placed.has(id)).slice(0, 50),
  }));
  return {
    cards: planned,
    gaps,
    summary: {
      tasks: planned.length,
      epics,
      foundations,
      derivedTests,
      backlog: planned.filter((c) => c.column === 'backlog').length,
    },
  };
}

/** Cards that can start now: waiting in "to do", not obsolete, with every card they depend on done. */
export function readyCards(cards: Card[]) {
  const done = new Set(cards.filter((c) => c.column === 'done').map((c) => c.id));
  const present = new Set(cards.map((c) => c.id));
  const blockedBy = (card: Card) => card.dependsOn.filter((id) => present.has(id) && !done.has(id));
  const todo = cards.filter((c) => c.column === 'todo' && !c.obsolete);
  return {
    ready: todo.filter((c) => !blockedBy(c).length),
    blocked: todo
      .filter((c) => blockedBy(c).length)
      .map((c) => ({ card: c, blockedBy: blockedBy(c) })),
  };
}
