import { toString } from 'mdast-util-to-string';
import { canonicalJson } from './domain';
import { cardSchema, parsePlanTasks, type Card } from './board';
import { itemSchema, patchSchema, type Item, type Spec, type SpecPatch } from './schema';
import {
  diagnostic,
  markdownTree,
  openSpecId,
  openSpecManifestSchema,
  readOpenSpecFiles,
  requirementBlocks,
  type OpenSpecDiagnostic,
  type OpenSpecManifest,
} from './openspec-format';

export function openSpecTasks(markdown: string, path: string) {
  const cards: Card[] = [];
  const diagnostics: OpenSpecDiagnostic[] = [];
  let group = '';
  for (const node of markdownTree(markdown).children) {
    if (node.type === 'heading') group = toString(node);
    if (node.type !== 'list') continue;
    for (const item of node.children) {
      const first = item.children[0];
      if (first?.type !== 'paragraph') continue;
      const text = markdown
        .slice(first.position!.start.offset!, first.position!.end.offset!)
        .trim();
      const match = /^\[([ xX/~-])\]\s+(?:(\d+(?:\.\d+)+)\s+)?(.+)$/s.exec(text);
      if (!match) continue;
      const explicit = /^([A-Za-z][\w.-]*-[-\w.]+)\s+(.+)$/s.exec(match[3]);
      const id = explicit?.[1] ?? openSpecId('TASK', `${path}:${match[2] ?? match[3]}`);
      const title = explicit?.[2] ?? match[3];
      const parsed = parsePlanTasks(
        `## ${group}\n- [${match[1]}] TASK-001 ${title.replace(/\n/g, ' ')}`,
      ).cards[0];
      if (!parsed || cards.some((c) => c.id === id)) {
        diagnostics.push(
          diagnostic(
            'duplicate-task',
            path,
            `Invalid or duplicate task: ${id}`,
            `Tâche invalide ou en double : ${id}`,
            'error',
          ),
        );
        continue;
      }
      const valid = cardSchema.safeParse({ ...parsed, id });
      if (!valid.success) {
        diagnostics.push(
          diagnostic(
            'invalid-task',
            path,
            'Task exceeds supported limits.',
            'La tâche dépasse les limites.',
            'error',
          ),
        );
        continue;
      }
      cards.push(valid.data);
    }
  }
  if (cards.length > 2000) throw new Error('OpenSpec: too many tasks');
  return { cards, diagnostics };
}

export type OpenSpecImport = {
  changes: string[];
  selectedChange?: string;
  diagnostics: OpenSpecDiagnostic[];
  patch: SpecPatch;
  cards: Card[];
  sources: Record<string, string>;
  recognised: string[];
};

export function planOpenSpecImport(
  spec: Spec,
  input: Record<string, string>,
  selectedChange?: string,
): OpenSpecImport {
  const { files, diagnostics } = readOpenSpecFiles(input);
  const changes = [
    ...new Set(
      [...files.keys()].flatMap((p) => /^openspec\/changes\/([^/]+)\//.exec(p)?.[1] ?? []),
    ),
  ]
    .filter((c) => c !== 'archive')
    .sort();
  const selected = selectedChange ?? (changes.length === 1 ? changes[0] : undefined);
  const result: OpenSpecImport = {
    changes,
    selectedChange: selected,
    diagnostics,
    patch: {},
    cards: [],
    sources: {},
    recognised: [],
  };
  if (changes.length > 1 && !selected) {
    diagnostics.push(
      diagnostic(
        'select-change',
        'openspec/changes',
        'Select one change to preview.',
        'Sélectionnez un changement à prévisualiser.',
        'error',
      ),
    );
    return result;
  }
  if (selected && !changes.includes(selected)) {
    diagnostics.push(
      diagnostic(
        'unknown-change',
        'openspec/changes',
        'Change not found.',
        'Changement introuvable.',
        'error',
      ),
    );
    return result;
  }
  let manifest: OpenSpecManifest | undefined;
  const rawManifest = files.get('openspec/sdd-manifest.json');
  if (rawManifest) {
    try {
      manifest = openSpecManifestSchema.parse(JSON.parse(rawManifest));
      const keys = new Set<string>(),
        ids = new Set<string>();
      for (const entry of manifest.requirements) {
        if (
          !/^openspec\/specs\/[a-z0-9/-]+\/spec\.md$/.test(entry.path) ||
          !itemSchema.shape.id.safeParse(entry.itemId).success ||
          keys.has(`${entry.path}:${entry.name}`) ||
          ids.has(entry.itemId)
        )
          throw new Error('Invalid mapping');
        keys.add(`${entry.path}:${entry.name}`);
        ids.add(entry.itemId);
      }
      if (manifest.projectId !== spec.id) {
        manifest = undefined;
        diagnostics.push(
          diagnostic(
            'foreign-manifest',
            'openspec/sdd-manifest.json',
            'Different source project; mappings are ignored.',
            'Projet source différent ; correspondances ignorées.',
          ),
        );
      }
    } catch {
      manifest = undefined;
      diagnostics.push(
        diagnostic(
          'invalid-manifest',
          'openspec/sdd-manifest.json',
          'Invalid mapping manifest.',
          'Manifeste de correspondance invalide.',
          'error',
        ),
      );
    }
  }
  const prefix = selected ? `openspec/changes/${selected}/` : 'openspec/';
  const touched = new Set<string>();
  const titleOf = (name: string) => name.replace(/^[A-Za-z][\w.-]*:\s+/, '');
  const mapping = (path: string, name: string) =>
    manifest?.requirements.find((e) => e.path === path && e.name === name)?.itemId;
  const resolve = (path: string, name: string): Item[] => {
    const id = mapping(path, name) ?? /^([A-Za-z][\w.-]*):\s+/.exec(name)?.[1];
    if (id) return spec.items.filter((i) => i.id === id);
    const hashed = openSpecId('REQ', `${path}:${name}`);
    const known = spec.items.filter((i) => i.id === hashed);
    return known.length
      ? known
      : spec.items.filter((i) => i.type === 'requirement' && i.title === name);
  };
  for (const [path, markdown] of files) {
    if (!path.startsWith(`${prefix}specs/`) || !path.endsWith('/spec.md')) continue;
    result.recognised.push(path);
    const capability = path.slice(`${prefix}specs/`.length, -'/spec.md'.length);
    if (!/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(capability)) {
      diagnostics.push(
        diagnostic(
          'invalid-capability',
          path,
          'Invalid capability path.',
          'Chemin de capacité invalide.',
          'error',
        ),
      );
      continue;
    }
    const canonicalPath = `openspec/specs/${capability}/spec.md`;
    const blocks = requirementBlocks(markdown, result.diagnostics, path);
    if (!blocks.length)
      diagnostics.push(
        diagnostic(
          'no-requirements',
          path,
          'No supported requirement blocks found.',
          'Aucun bloc d’exigence pris en charge.',
          'error',
        ),
      );
    for (const block of blocks) {
      const targets = resolve(canonicalPath, block.name);
      const old = targets[0];
      const id =
        old?.id ??
        mapping(canonicalPath, block.name) ??
        /^([A-Za-z][\w.-]*):\s+/.exec(block.name)?.[1] ??
        openSpecId('REQ', `${canonicalPath}:${block.name}`);
      const fail = (code: string, en: string, fr: string) =>
        diagnostics.push(
          diagnostic(code, path, `${block.name}: ${en}`, `${block.name} : ${fr}`, 'error'),
        );
      if (targets.length > 1 || (old && old.type !== 'requirement') || touched.has(id)) {
        fail('ambiguous-target', 'Ambiguous or duplicate target.', 'Cible ambiguë ou en double.');
        continue;
      }
      touched.add(id);
      if (['modified', 'removed', 'renamed'].includes(block.operation) && !old) {
        fail('missing-target', 'Target requirement is missing.', 'Exigence cible absente.');
        continue;
      }
      if (block.operation === 'removed') {
        if (!/Reason/.test(block.body) || !/Migration/.test(block.body)) {
          fail(
            'removal-context',
            'Removal requires Reason and Migration.',
            'Le retrait exige Reason et Migration.',
          );
          continue;
        }
        (result.patch.removeItems ??= []).push(id);
        continue;
      }
      const next =
        block.operation === 'renamed'
          ? { ...old!, title: titleOf(block.to!), status: 'draft', needsReview: true }
          : {
              ...old,
              id,
              type: 'requirement',
              title: titleOf(block.name),
              body: block.body,
              acceptance: block.acceptance,
              status: 'draft',
              needsReview: true,
            };
      if (
        block.operation === 'renamed' &&
        spec.items.some((i) => i.id !== id && i.type === 'requirement' && i.title === next.title)
      ) {
        fail('rename-collision', 'The new name already exists.', 'Le nouveau nom existe déjà.');
        continue;
      }
      const parsed = itemSchema.safeParse(next);
      if (!parsed.success) {
        fail(
          'invalid-requirement',
          'Requirement exceeds supported limits.',
          'L’exigence dépasse les limites.',
        );
        continue;
      }
      const sameContent =
        old &&
        canonicalJson({ title: old.title, body: old.body, acceptance: old.acceptance }) ===
          canonicalJson({
            title: parsed.data.title,
            body: parsed.data.body,
            acceptance: parsed.data.acceptance,
          });
      if (sameContent) continue;
      if (block.operation === 'added' && old) {
        fail(
          'existing-target',
          'ADDED conflicts with an existing requirement.',
          'ADDED entre en conflit avec une exigence existante.',
        );
        continue;
      }
      (result.patch.items ??= []).push(parsed.data);
    }
  }
  const removals = new Set(result.patch.removeItems);
  const removeLinks = spec.links
    .filter((l) => removals.has(l.from) || removals.has(l.to))
    .map((l) => l.id);
  if (removeLinks.length) result.patch.removeLinks = removeLinks;
  const taskPath = selected ? `${prefix}tasks.md` : 'tasks.md';
  if (files.has(taskPath)) {
    const tasks = openSpecTasks(files.get(taskPath)!, taskPath);
    result.cards = tasks.cards;
    diagnostics.push(...tasks.diagnostics);
    result.recognised.push(taskPath);
  }
  for (const path of selected
    ? [`${prefix}proposal.md`, `${prefix}design.md`]
    : ['PRODUCT.md', 'DESIGN.md', 'spec.md']) {
    const content = files.get(path);
    if (content !== undefined) {
      result.sources[path] = content;
      result.recognised.push(path);
    }
  }
  if (!result.recognised.length)
    diagnostics.push(
      diagnostic(
        'no-content',
        'openspec',
        'No supported OpenSpec files found.',
        'Aucun fichier OpenSpec pris en charge.',
        'error',
      ),
    );
  result.patch = patchSchema.parse(result.patch);
  return result;
}
