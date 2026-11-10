import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

/**
 * A small architecture-rule engine inspired by ArchUnit and ts-arch, without a dependency:
 * file selections, dependency rules, package rules, naming, cycle detection and slices that must
 * adhere to a PlantUML component diagram. Rules return violations (empty when the rule holds).
 */
export const projectRoot = resolve(__dirname, '..', '..');
const ignored = /(^|\/)(node_modules|dist|storybook-static|test-results|playwright-report|lighthouse-report|\.git|\.runtime)(\/|$)/;

type Graph = Map<string, string[]>;
let cache: Graph | null = null;

function walk(dir: string): string[] {
  return readdirSync(join(projectRoot, dir)).flatMap((name) => {
    const path = dir ? `${dir}/${name}` : name;
    if (ignored.test(path)) return [];
    return statSync(join(projectRoot, path)).isDirectory() ? walk(path) : /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}
function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = normalize(join(dirname(from), specifier)).split('\\').join('/');
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`])
    if (/\.tsx?$/.test(candidate) && existsSync(join(projectRoot, candidate))) return candidate;
  return null;
}
/** Runtime imports (static and dynamic). `import type` is erased and does not couple modules. */
export function importsOf(file: string) {
  const text = readFileSync(join(projectRoot, file), 'utf8');
  const staticImports = [...text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)];
  const dynamicImports = [...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)];
  return [...staticImports, ...dynamicImports].map((m) => m[1]);
}
export function dependencyGraph(): Graph {
  cache ??= new Map(walk('').map((f) => [f, importsOf(f).map((s) => resolveImport(f, s)).filter((x): x is string => !!x)]));
  return cache;
}

type Filter = (file: string) => boolean;
const folderFilter =
  (folder: string): Filter =>
  (f) =>
    f.startsWith(folder.endsWith('/') ? folder : `${folder}/`);
export type Rule = { check: () => string[] };

class FileSelection {
  constructor(private filters: Filter[] = []) {}
  inFolder(folder: string) {
    return new FileSelection([...this.filters, folderFilter(folder)]);
  }
  matchingPattern(pattern: RegExp) {
    return new FileSelection([...this.filters, (f) => pattern.test(f)]);
  }
  excluding(pattern: RegExp) {
    return new FileSelection([...this.filters, (f) => !pattern.test(f)]);
  }
  files() {
    return [...dependencyGraph().keys()].filter((f) => this.filters.every((p) => p(f)));
  }
  should() {
    return new Condition(this, true);
  }
  shouldNot() {
    return new Condition(this, false);
  }
}

class Condition {
  constructor(
    private subject: FileSelection,
    private positive: boolean,
  ) {}

  /** `shouldNot().dependOnFiles().inFolder('apps/web')` */
  dependOnFiles() {
    const { subject, positive } = this;
    return {
      inFolder: (folder: string): Rule => ({
        check: () => {
          const target = folderFilter(folder);
          return subject.files().flatMap((f) => {
            const hits = (dependencyGraph().get(f) ?? []).filter(target);
            if (positive) return hits.length ? [] : [`${f} does not depend on ${folder}`];
            return hits.map((h) => `${f} → ${h}`);
          });
        },
      }),
    };
  }

  /** Bare package specifiers, e.g. `shouldNot().importPackagesMatching(/^node:|^fastify/)`. */
  importPackagesMatching(pattern: RegExp): Rule {
    const { subject, positive } = this;
    return {
      check: () =>
        subject.files().flatMap((f) => {
          const hits = importsOf(f).filter((s) => !s.startsWith('.') && pattern.test(s));
          return positive ? (hits.length ? [] : [`${f} imports nothing matching ${pattern}`]) : hits.map((h) => `${f} → ${h}`);
        }),
    };
  }

  haveNameMatching(pattern: RegExp): Rule {
    const { subject, positive } = this;
    return {
      check: () =>
        subject
          .files()
          .filter((f) => pattern.test(f.slice(f.lastIndexOf('/') + 1)) !== positive)
          .map((f) => `${f}: name ${positive ? 'does not match' : 'matches'} ${pattern}`),
    };
  }

  beFreeOfCycles(): Rule {
    const { subject } = this;
    return {
      check: () => {
        const files = new Set(subject.files());
        const cycles: string[] = [];
        const state = new Map<string, 1 | 2>();
        const visit = (node: string, stack: string[]) => {
          state.set(node, 1);
          for (const next of (dependencyGraph().get(node) ?? []).filter((n) => files.has(n))) {
            if (state.get(next) === 1) cycles.push([...stack.slice(stack.indexOf(next)), next].join(' → '));
            else if (!state.has(next)) visit(next, [...stack, next]);
          }
          state.set(node, 2);
        };
        for (const f of files) if (!state.has(f)) visit(f, [f]);
        return cycles;
      },
    };
  }
}

export const filesOfProject = () => new FileSelection();

/** Slices are named by the first capture group of a path pattern, e.g. /^apps\/([^/]+)\//. */
export function slicesOfProject() {
  return {
    definedBy(pattern: RegExp) {
      const sliceOf = (f: string) => pattern.exec(f)?.[1] ?? null;
      const dependencies = () => {
        const edges = new Map<string, Set<string>>();
        for (const [file, deps] of dependencyGraph()) {
          const from = sliceOf(file);
          if (!from) continue;
          for (const d of deps) {
            const to = sliceOf(d);
            if (to && to !== from) edges.set(from, (edges.get(from) ?? new Set()).add(to));
          }
        }
        return edges;
      };
      return {
        dependencies,
        should: () => ({
          /** Every slice dependency found in code must be drawn in the PlantUML component diagram. */
          adhereToDiagramInFile: (path: string): Rule => ({
            check: () => {
              const allowed = parsePlantUml(readFileSync(path, 'utf8'));
              const violations: string[] = [];
              for (const [from, targets] of dependencies())
                for (const to of targets) if (!allowed.has(`${from}->${to}`)) violations.push(`${from} → ${to} is not drawn in ${relative(projectRoot, path)}`);
              return violations;
            },
          }),
        }),
      };
    },
  };
}

/** Reads `[a] --> [b]` or `a --> b` edges; `[Label] as a` and `component "Label" as a` define aliases. */
export function parsePlantUml(text: string) {
  const alias = new Map<string, string>();
  for (const m of text.matchAll(/(?:\[([^\]]+)\]|"([^"]+)")\s+as\s+([\w-]+)/g)) alias.set(m[1] ?? m[2], m[3]);
  const name = (raw: string) => {
    const clean = raw.replace(/^\[|\]$/g, '').trim();
    return alias.get(clean) ?? clean;
  };
  const edges = new Set<string>();
  for (const m of text.matchAll(/^\s*(\[[^\]]+\]|[\w-]+)\s*[-.]+(?:\[[^\]]*\])?[-.]*>\s*(\[[^\]]+\]|[\w-]+)/gm)) edges.add(`${name(m[1])}->${name(m[2])}`);
  return edges;
}
