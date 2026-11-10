import { describe, expect, it } from 'vitest';
import { projectFiles, projectSlices, sliceByRegex } from 'archunit';

/**
 * Architecture rules enforced with ArchUnitTS (https://github.com/LukasNiessen/ArchUnitTS). Unlike
 * tests/arch/rules.ts, ArchUnitTS also follows `import type`, so these rules keep the type graph
 * acyclic too. Package-level bans, route registration and the route security sweep stay in
 * tests/architecture.test.ts.
 */

type Edge = { sourceLabel: string; targetLabel: string };
type AnyViolation = {
  dependency?: Edge;
  cycle?: Edge[];
  projectedEdge?: Edge;
  projectedNode?: { label: string };
  checkPattern?: string;
  fileInfo?: { path: string };
  message?: string;
};

const describeViolation = (violation: object): string => {
  const v = violation as AnyViolation;
  if (v.dependency) return `${v.dependency.sourceLabel} → ${v.dependency.targetLabel}`;
  if (v.cycle) return `cycle: ${[...v.cycle.map((e) => e.sourceLabel), v.cycle[0]?.sourceLabel].join(' → ')}`;
  if (v.projectedEdge) return `${v.projectedEdge.sourceLabel} → ${v.projectedEdge.targetLabel} is not drawn in the diagram`;
  if (v.projectedNode) return `${v.projectedNode.label} does not match ${v.checkPattern}`;
  if (v.fileInfo) return `${v.fileInfo.path}: ${v.message}`;
  return v.message ?? JSON.stringify(violation);
};

/** Runs an ArchUnitTS rule and returns readable violations; empty selections count as failures. */
const violations = async (rule: { check: () => Promise<object[]> }) => (await rule.check()).map(describeViolation);

const notProduction = { except: { withName: [/\.(test|stories)\.tsx?$/] } };
const pascalCase = /^[A-Z][A-Za-z0-9]*\.tsx$/;
const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.ts$/;
const maxLines = (limit: number) => (file: { linesOfCode: number }) => file.linesOfCode < limit;

describe('ArchUnitTS: rule engine sanity', () => {
  it('resolves workspace imports, so the negative rules below are not vacuous', async () => {
    const rule = projectFiles().inFolder('apps/web/src/**').shouldNot().dependOnFiles().inFolder('packages/shared/src/**');
    expect((await violations(rule)).length).toBeGreaterThan(10);
  }, 60_000);
});

describe('ArchUnitTS: frontend (apps/web)', () => {
  const web = () => projectFiles().inFolder('apps/web/src/**', notProduction);

  it('does not depend on the API, the publisher, the agent runner or scripts', async () => {
    for (const folder of ['apps/api/**', 'apps/publisher/**', 'apps/agent-runner/**', 'scripts/**'])
      expect(await violations(web().shouldNot().dependOnFiles().inFolder(folder))).toEqual([]);
  });

  it('keeps production code independent of tests and stories', async () => {
    expect(await violations(web().shouldNot().dependOnFiles().withName(/\.(test|stories)\.tsx?$/))).toEqual([]);
  });

  it('keeps components independent of views', async () => {
    const components = projectFiles().inFolder('apps/web/src/components/**', notProduction);
    expect(await violations(components.shouldNot().dependOnFiles().inFolder('apps/web/src/views/**'))).toEqual([]);
  });

  it('has no import cycles, type imports included', async () => {
    expect(await violations(projectFiles().inFolder('apps/web/src/**').should().haveNoCycles())).toEqual([]);
  });

  it('names views and components in PascalCase', async () => {
    expect(await violations(projectFiles().inFolder('apps/web/src/views/**', notProduction).should().haveName(pascalCase))).toEqual([]);
    const components = projectFiles().inFolder('apps/web/src/components/**', { except: { withName: [/\.(test|stories)\.tsx$/, 'ui.tsx'] } });
    expect(await violations(components.should().haveName(pascalCase))).toEqual([]);
  });

  it('keeps files within their size budget', async () => {
    const budget = (folder: string, limit: number) =>
      projectFiles().inFolder(folder, notProduction).should().adhereTo(maxLines(limit), `must stay under ${limit} lines; split it`);
    expect(await violations(budget('apps/web/src/views/**', 800))).toEqual([]);
    expect(await violations(budget('apps/web/src/components/**', 300))).toEqual([]);
    expect(await violations(budget('apps/web/src/**', 900))).toEqual([]);
  });
});

describe('ArchUnitTS: backend (apps/api)', () => {
  const api = () => projectFiles().inFolder('apps/api/src/**');

  it('does not depend on the web client, the publisher or the agent runner', async () => {
    for (const folder of ['apps/web/**', 'apps/publisher/**', 'apps/agent-runner/**'])
      expect(await violations(api().shouldNot().dependOnFiles().inFolder(folder))).toEqual([]);
  });

  it('keeps feature modules independent of the application root', async () => {
    const modules = projectFiles().inFolder('apps/api/src/**', { except: { withName: ['app.ts', 'index.ts'] } });
    expect(await violations(modules.shouldNot().dependOnFiles().inPath('apps/api/src/app.ts'))).toEqual([]);
  });

  it('has no import cycles, type imports included', async () => {
    expect(await violations(api().should().haveNoCycles())).toEqual([]);
  });

  it('names modules in kebab-case', async () => {
    expect(await violations(api().should().haveName(kebabCase))).toEqual([]);
  });

  it('keeps modules within their size budget', async () => {
    expect(await violations(api().should().adhereTo(maxLines(500), 'must stay under 500 lines; split it'))).toEqual([]);
  });
});

describe('ArchUnitTS: shared domain and services', () => {
  const shared = () => projectFiles().inFolder('packages/shared/src/**');

  it('keeps the shared domain free of application, script and test code', async () => {
    for (const folder of ['apps/**', 'scripts/**', 'tests/**'])
      expect(await violations(shared().shouldNot().dependOnFiles().inFolder(folder))).toEqual([]);
  });

  it('keeps the question library from importing the template builder back', async () => {
    const library = projectFiles().inFolder('packages/shared/src/library/**');
    expect(await violations(library.shouldNot().dependOnFiles().inPath('packages/shared/src/templates.ts'))).toEqual([]);
  });

  it('has no import cycles, names modules in kebab-case and keeps domain modules small', async () => {
    expect(await violations(shared().should().haveNoCycles())).toEqual([]);
    expect(await violations(shared().should().haveName(kebabCase))).toEqual([]);
    const domain = projectFiles().inFolder('packages/shared/src/**', { except: { inFolder: ['packages/shared/src/library/**'] } });
    expect(await violations(domain.should().adhereTo(maxLines(650), 'must stay under 650 lines; split it'))).toEqual([]);
  });

  it('keeps the publisher and agent runner independent of the API and web client', async () => {
    for (const service of ['apps/publisher/src/**', 'apps/agent-runner/src/**']) {
      const files = () => projectFiles().inFolder(service);
      for (const folder of ['apps/api/**', 'apps/web/**']) expect(await violations(files().shouldNot().dependOnFiles().inFolder(folder))).toEqual([]);
      expect(await violations(files().should().haveNoCycles())).toEqual([]);
    }
  });
});

describe('ArchUnitTS: slices', () => {
  const slices = () => {
    const builder = projectSlices();
    // definedBy() captures \w+ only, which cannot express agent-runner or the top-level scripts folder.
    builder.mapFunction = sliceByRegex(/^(?:apps\/|packages\/)?(web|api|shared|publisher|agent-runner|scripts)\//);
    return builder;
  };

  it('adhere to docs/architecture/components.puml', async () => {
    expect(await violations(slices().should().adhereToDiagramInFile('docs/architecture/components.puml'))).toEqual([]);
  });

  it('reports dependencies the diagram does not draw', async () => {
    const diagram = '@startuml\ncomponent [web]\ncomponent [shared]\ncomponent [api]\nweb --> shared\n@enduml';
    expect(await violations(slices().should().adhereToDiagram(diagram))).toContain('api → shared is not drawn in the diagram');
  });

  it('never let the server, the domain or the services depend on the web client', async () => {
    const rule = slices()
      .shouldNot()
      .containDependency('api', 'web')
      .containDependency('shared', 'web')
      .containDependency('shared', 'api')
      .containDependency('publisher', 'web')
      .containDependency('agent-runner', 'web');
    expect(await violations(rule)).toEqual([]);
  });
});
