import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditSkills, isGeneratedSkill, parseSkill, repositorySkills, skillLimits, skillsIn, type SkillFiles } from '../packages/shared/src/skill-audit';
import { buildExampleSpec } from '../packages/shared/src/example';
import { createSpec } from '../packages/shared/src/domain';
import { itemSchema, type Spec } from '../packages/shared/src/schema';
import { modules } from '../packages/shared/src/templates';
import { renderSection } from '../packages/shared/src/markdown';
import { maintainSkill, skillFiles, skillName, withContents } from '../apps/api/src/skill-export';
import { agentFiles } from '../apps/api/src/exports';

/**
 * Anthropic's skill authoring rules (the ones in the "Everything you know about skills is outdated"
 * video): content lists on long references, one-level references, third-person descriptions that say
 * when, checklists and fix-and-repeat loops, no volatile facts. Each rule, then every skill we ship.
 */
const good = { name: 'demo', description: 'Summarizes meeting notes into action items. Use when the user shares notes or a transcript.' };
const skill = (meta: Record<string, string>, body = 'Summarize the notes.\n', extra: Record<string, string> = {}, dir = 'demo'): SkillFiles => ({
  [`${dir}/SKILL.md`]: `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}`,
  ...Object.fromEntries(Object.entries(extra).map(([p, text]) => [`${dir}/${p}`, text])),
});
const found = (files: SkillFiles) => auditSkills(files).map((f) => `${f.severity}:${f.rule}`);
const lines = (n: number, prefix = 'line') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n');
const steps = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}. Step ${i + 1}`).join('\n');

describe('skill audit rules', () => {
  it('accepts a small, well-formed skill', () => {
    expect(auditSkills(skill(good))).toEqual([]);
  });

  it('requires frontmatter, and finds skills at any depth', () => {
    expect(found({ 'demo/SKILL.md': '# No frontmatter' })).toEqual(['error:frontmatter']);
    const files = { 'SKILL.md': '---\nname: a\n---\n', 'x/y/SKILL.md': 'z', 'x/y/notes.md': 'n', 'x/other.md': 'o' };
    expect(skillsIn(files).map((s) => [s.dir, Object.keys(s.files).sort()])).toEqual([['', ['SKILL.md', 'x/other.md', 'x/y/SKILL.md', 'x/y/notes.md']], ['x/y', ['SKILL.md', 'notes.md']]]);
  });

  it('checks the name: characters, length, reserved words, folder and vagueness', () => {
    expect(found(skill({ ...good, name: 'Meeting Notes' }))).toContain('error:name');
    expect(found(skill({ ...good, name: 'a'.repeat(65) }, undefined, {}, 'a'.repeat(65)))).toContain('error:name');
    expect(found(skill({ ...good, name: 'claude-helper' }, undefined, {}, 'claude-helper'))).toContain('error:name-reserved');
    expect(found(skill({ ...good, name: 'anthropic-tools' }, undefined, {}, 'anthropic-tools'))).toContain('error:name-reserved');
    expect(found(skill({ ...good, name: 'other' }))).toContain('error:name-directory');
    expect(found(skill({ ...good, name: 'helper' }, undefined, {}, 'helper'))).toContain('warning:name-vague');
    expect(found(skill({ ...good, name: 'demo-' }, undefined, {}, 'demo-'))).toContain('warning:name-hyphens');
    expect(found(skill({ description: good.description }))).toContain('error:name');
  });

  it('checks the description: present, short enough, no tags, third person, says when', () => {
    expect(found(skill({ name: 'demo', description: '' }))).toContain('error:description');
    expect(found(skill({ name: 'demo', description: `"${'x'.repeat(skillLimits.description + 1)} when"` }))).toContain('error:description');
    expect(found(skill({ ...good, description: '"Summarizes <b>notes</b>. Use when asked."' }))).toContain('error:description-tags');
    expect(found(skill({ ...good, description: 'Summarizes notes when 3 < 4 and 5 > 4 holds in a long enough sentence.' }))).not.toContain('error:description-tags');
    for (const bad of ['I can help you summarize meeting notes. Use when asked.', 'You can use this to summarize notes when you need to.', 'We summarize notes. Use when asked about meetings.'])
      expect(found(skill({ ...good, description: bad })), bad).toContain('error:description-person');
    expect(found(skill({ ...good, description: 'Summarizes meeting notes into action items for the team.' }))).toContain('error:description-when');
    expect(found(skill({ ...good, description: 'Helps with notes' }))).toEqual(expect.arrayContaining(['error:description-when', 'warning:description-vague']));
  });

  it('keeps volatile facts out of the description and out of the body', () => {
    expect(found(skill({ ...good, description: '"Summarizes notes of the project at revision 12. Use when asked."' }))).toContain('warning:volatile');
    expect(found(skill({ ...good, description: '"Summarizes notes (exported 2026-10-01). Use when asked about meetings."' }))).toContain('warning:volatile');
    expect(found(skill(good, 'Use the old API before August 2025, the new one after.\n'))).toContain('warning:volatile');
    expect(found(skill(good, 'The v2 API is current.\n<details><summary>Legacy v1 API (deprecated 2025-08)</summary>old</details>\n'))).not.toContain('warning:volatile');
  });

  it('reads YAML the way a parser does: quoted strings, folded blocks, and values that would not survive unquoted', () => {
    expect(parseSkill('---\nname: "a"\ndescription: "He said \\"hi\\". Use when asked."\n---\n')?.meta.description).toBe('He said "hi". Use when asked.');
    expect(parseSkill("---\nname: 'a'\ndescription: 'It''s fine'\n---\n")?.meta.description).toBe("It's fine");
    expect(parseSkill('---\nname: a\ndescription: >\n  Summarizes notes.\n  Use when asked.\n---\nBody')).toMatchObject({ meta: { description: 'Summarizes notes. Use when asked.' }, body: 'Body' });
    expect(found(skill({ ...good, description: 'Summarizes notes: use when asked about meetings and notes.' }))).toContain('error:frontmatter-yaml');
    expect(found(skill({ ...good, description: 'Summarizes notes #1. Use when asked about meetings.' }))).toContain('error:frontmatter-yaml');
    expect(found(skill({ ...good, description: '"Summarizes notes: use when asked about meetings and notes."' }))).not.toContain('error:frontmatter-yaml');
    expect(found(skill({ ...good, description: '>\n  Summarizes notes: use when asked.' }))).not.toContain('error:frontmatter-yaml');
  });

  it('keeps the body under 500 lines', () => {
    expect(found(skill(good, `${lines(skillLimits.bodyLines - 1)}\n`))).toEqual([]);
    expect(found(skill(good, `${lines(skillLimits.bodyLines + 5)}\n`))).toContain('error:body-length');
  });

  it('asks a multi-step workflow for a checklist and a check-fix-repeat step', () => {
    expect(found(skill(good, `${steps(5)}\n`))).toEqual(expect.arrayContaining(['warning:checklist', 'warning:feedback-loop']));
    expect(found(skill(good, `${steps(4)}\n`))).toEqual([]);
    expect(found(skill(good, `- [ ] one\n- [ ] two\n`))).toContain('warning:feedback-loop');
    expect(found(skill(good, `- [ ] one\n- [ ] two\n\nIf a check fails, fix the cause and run it again.\n`))).toEqual([]);
    expect(found(skill(good, `${steps(5)}\n\n\`\`\`\n- [ ] a\n\`\`\`\nStop and report anything that contradicts the notes.\n`))).toEqual([]);
  });

  it('rejects Windows-style paths in the instructions', () => {
    expect(found(skill(good, 'Run `scripts\\check.py` first.\n'))).toContain('error:path-windows');
    expect(found(skill(good, 'Run `scripts/check.py` first.\n'))).not.toContain('error:path-windows');
  });

  it('wants every bundled file linked from SKILL.md, and every link to exist', () => {
    const body = 'Details: see references/guide.md and [more](advanced.md).\n';
    expect(found(skill(good, body, { 'references/guide.md': 'g', 'advanced.md': 'a' }))).toEqual([]);
    expect(found(skill(good, body, { 'references/guide.md': 'g' }))).toContain('error:reference-missing');
    expect(found(skill(good, 'See references/guide.md.\n', { 'references/guide.md': 'g', 'references/hidden.md': 'h' }))).toEqual(['error:reference-orphan']);
    // A mention of the folder is enough for files that belong to a described group.
    expect(found(skill(good, 'See the files in references/sections/.\n', { 'references/sections/a.md': 'a' }))).toEqual([]);
    // Links that leave the skill are not the skill's own files.
    expect(found(skill(good, 'Project rules: [AGENTS.md](../../AGENTS.md) and [docs](https://example.com/a.md).\n'))).toEqual([]);
  });

  it('keeps references one level deep', () => {
    const body = 'See references/a.md and references/b.md.\n';
    expect(found(skill(good, body, { 'references/a.md': 'Continue in [b](b.md).', 'references/b.md': 'b' }))).toEqual(['error:reference-nested']);
    expect(found(skill(good, body, { 'references/a.md': 'Also read references/b.md.', 'references/b.md': 'b' }))).toEqual(['error:reference-nested']);
    // A pointer by file name (even in capitals) is still a second hop.
    expect(found(skill(good, 'See references/product.md and references/design.md.\n', { 'references/product.md': 'p', 'references/design.md': 'See PRODUCT.md for the problem.' }))).toEqual(['error:reference-nested']);
    expect(found(skill(good, body, { 'references/a.md': 'Self-contained.', 'references/b.md': 'Also self-contained.' }))).toEqual([]);
  });

  it('wants a contents list at the top of a reference over 100 lines', () => {
    const reference = (text: string) => skill(good, 'See references/long.md.\n', { 'references/long.md': text });
    expect(found(reference(lines(skillLimits.referenceLines)))).toEqual([]);
    expect(found(reference(lines(skillLimits.referenceLines + 20)))).toEqual(['error:reference-contents']);
    expect(found(reference(`# Long\n\n## Contents\n\n- A\n- B\n\n${lines(120)}`))).toEqual([]);
    expect(found(reference(`# Long\n\n## Sommaire\n\n- A\n\n${lines(120)}`))).toEqual([]);
    expect(found(reference(`${lines(60)}\n## Contents\n${lines(60)}`))).toEqual(['error:reference-contents']);
  });

  it('asks a skill with scripts to say what they need', () => {
    const files = (body: string) => skill(good, body, { 'scripts/run.py': 'print(1)' });
    expect(found(files('Run scripts/run.py on the input.\n'))).toEqual(['warning:dependencies']);
    expect(found(files('Requires Python 3.11. Run scripts/run.py on the input.\n'))).toEqual([]);
  });
});

describe('contents lists for long files', () => {
  const doc = `# Title\n\n> Generated note.\n\n${Array.from({ length: 12 }, (_, i) => `## Part ${i + 1}\n\n${lines(6)}\n`).join('\n')}`;

  it('leaves short files alone and lists the second-level headings of long ones, after any note under the title', () => {
    expect(withContents('# Short\n\n## A\n\ntext', 'en')).toBe('# Short\n\n## A\n\ntext');
    const out = withContents(doc, 'en').split('\n');
    expect(out.slice(0, 5)).toEqual(['# Title', '', '> Generated note.', '', '## Contents']);
    expect(out).toContain('- Part 1');
    expect(out).toContain('- Part 12');
    expect(withContents(doc, 'fr')).toContain('## Sommaire');
  });

  it('ignores headings inside code blocks and keeps files without headings as they are', () => {
    const fenced = `# T\n\n## Real\n\n\`\`\`\n## Not a heading\n\`\`\`\n\n${lines(90)}`;
    const out = withContents(fenced, 'en');
    expect(out).toContain('- Real');
    expect(out).not.toContain('- Not a heading');
    expect(withContents(lines(120), 'en')).toBe(lines(120));
  });
});

describe('the skills of this repository', () => {
  const read = (dir: string): SkillFiles => {
    const files: SkillFiles = {};
    const walk = (folder: string, base: string) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(folder, entry.name), `${base}/${entry.name}`);
        else files[`${base}/${entry.name}`] = readFileSync(join(folder, entry.name), 'utf8').replace(/\r\n/g, '\n');
      }
    };
    walk(join(__dirname, '..', dir), dir);
    return files;
  };

  // The skills written here; those another tool generates (OpenSpec's) are rewritten by that tool and differ per agent.
  const own = (dir: string) => repositorySkills(read(dir));

  it('pass every rule, warnings included', () => {
    for (const dir of ['.claude/skills', '.agents/skills']) {
      const { files } = own(dir);
      expect(skillsIn(files).map((s) => s.dir.split('/').pop()), dir).toContain('sdd-studio-maintenance');
      expect(auditSkills(files), dir).toEqual([]);
    }
  });

  it('are the same in .claude and .agents', () => {
    const claude = own('.claude/skills').files;
    const agents = Object.fromEntries(Object.entries(own('.agents/skills').files).map(([p, text]) => [p.replace('.agents', '.claude'), text]));
    expect(agents).toEqual(claude);
  });

  it('leave skills another tool generates alone, and say which they are', () => {
    const generated = { 'x/SKILL.md': '---\nname: x\ndescription: Tool made.\nmetadata:\n  author: openspec\n  generatedBy: "1.14.1"\n---\n\nBody' };
    expect(isGeneratedSkill(generated['x/SKILL.md'])).toBe(true);
    expect(isGeneratedSkill('---\nname: x\ndescription: Hand written. Use when needed.\n---\n')).toBe(false);
    // A word in the body is not a marker.
    expect(isGeneratedSkill('---\nname: x\ndescription: d\n---\n\n  generatedBy: "1"')).toBe(false);
    const tree = { ...generated, 'y/SKILL.md': '---\nname: y\ndescription: Hand written. Use when needed.\n---\n', 'y/notes.md': 'n', '.loose': 'l' };
    expect(repositorySkills(tree)).toEqual({ files: { 'y/SKILL.md': tree['y/SKILL.md'], 'y/notes.md': 'n' }, generated: ['x'] });
    // Whatever the repository holds today: the generated ones are real OpenSpec skills, the others are ours.
    const { generated: found } = own('.claude/skills');
    for (const dir of found) expect(dir, 'only OpenSpec skills are generated here').toMatch(/openspec/);
  });
});

describe('the skill SDD Studio writes for a project', () => {
  const example = buildExampleSpec('00000000-0000-4000-8000-0000000000e1');
  const named = (name: string, language: 'en' | 'fr' = 'en') => createSpec('00000000-0000-4000-8000-0000000000e2', name, language, false, 'Web application');
  const skillOf = (spec: Spec) => {
    const files = skillFiles(spec);
    const path = Object.keys(files).find((p) => p.endsWith('/SKILL.md'))!;
    return { files, path, dir: path.split('/')[0], parsed: parseSkill(files[path])! };
  };
  const section = (spec: Spec, id: string) => spec.sections.find((s) => s.id === id)!;

  it('turns any project name into a valid skill name', () => {
    expect(skillName('Customer Request Portal')).toBe('customer-request-portal-spec');
    expect(skillName('Claude <b>Helper</b>')).toBe('helper-spec');
    expect(skillName('Anthropic Claude')).toBe('project-spec');
    expect(skillName('日本語')).toBe('project-spec');
    expect(skillName('')).toBe('project-spec');
    expect(skillName('Café Ünïcode!')).toBe('cafe-unicode-spec');
    expect(skillName('My_Project  v2 -- beta')).toBe('my-project-v2-beta-spec');
    const long = skillName('word '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(skillLimits.name);
    expect(long).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-spec$/);
    for (const name of ['Customer Request Portal', 'Claude <b>Helper</b>', 'x'.repeat(300), '--', '"quoted": name #1']) expect(skillName(name), name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('passes every rule, warnings included, for projects of every shape', () => {
    const big = structuredClone(example);
    big.items = Array.from({ length: 150 }, (_, i) => itemSchema.parse({ id: `REQ-${String(i + 1).padStart(3, '0')}`, type: 'requirement', title: `Requirement ${i + 1}`, body: 'Body text.', status: i % 3 ? 'accepted' : 'draft', acceptance: 'Verified by a test.' }));
    const awkward = ['Claude <b>Helper</b>', 'a: b # c', '"Quoted" & <i>tagged</i>', 'x'.repeat(300), '  ', 'Projet Ünï — français'];
    const specs: [string, Spec][] = [
      ['example', example],
      ['empty', named('Empty project')],
      ['french', named('Portail de demandes', 'fr')],
      ['150 requirements', big],
      ...awkward.map((name): [string, Spec] => [`named ${JSON.stringify(name).slice(0, 30)}`, named(name)]),
    ];
    for (const [label, spec] of specs) expect(auditSkills(skillFiles(spec)), label).toEqual([]);
    expect(auditSkills(agentFiles(example)), 'maintain-spec').toEqual([]);
    expect(auditSkills({ '.claude/skills/maintain-spec/SKILL.md': maintainSkill })).toEqual([]);
  });

  it('keeps the revision out of the description and says it in the body', () => {
    const spec = { ...structuredClone(example), revision: 42 };
    const { files, path, parsed } = skillOf(spec);
    expect(parsed.meta.name).toBe('customer-request-portal-spec');
    expect(parsed.meta.description).toMatch(/^Provides the approved design of Customer Request Portal/);
    expect(parsed.meta.description).not.toMatch(/42|revision/);
    expect(files[path]).toContain('snapshot of the SDD Studio specification at revision 42');
  });

  it('writes the description as quoted YAML so punctuation in a project name cannot break it', () => {
    const { parsed } = skillOf(named('Portal: "alpha" #1 {beta}'));
    expect(parsed.meta.description).toContain('Portal: "alpha" #1 {beta}');
    expect(parsed.raw.description.startsWith('"')).toBe(true);
  });

  it('gives each long reference a contents list so a partial read shows what it covers', () => {
    const { files, dir } = skillOf(example);
    const design = files[`${dir}/references/design.md`];
    expect(design.split('\n').length).toBeGreaterThan(skillLimits.referenceLines);
    expect(design.split('\n').slice(0, 30).join('\n')).toMatch(/## Contents[\s\S]*- Open questions/);
    expect(files[`${dir}/references/product.md`]).toMatch(/^# .*\n[\s\S]{0,300}## Contents/);
  });

  it('does not point from one reference to another', () => {
    const { files, dir } = skillOf(example);
    expect(files[`${dir}/references/design.md`]).not.toMatch(/PRODUCT\.md/);
    // The files in the repository root keep their pointer: there it is a real file next to it.
    expect(agentFiles(example)['DESIGN.md']).toContain('See PRODUCT.md');
  });

  it('splits items by type so an agent opens only the kind it needs', () => {
    const { files, dir } = skillOf(example);
    expect(files[`${dir}/references/items/requirements.md`]).toContain('## REQ-001:');
    expect(files[`${dir}/references/items/requirements.md`]).not.toContain('## UC-');
    expect(Object.keys(files).filter((p) => p.endsWith('/items.md'))).toEqual([]);
    const empty = skillOf(named('Nothing yet'));
    expect(Object.keys(empty.files).filter((p) => p.includes('/items/'))).toEqual([]);
  });

  it('marks drafts and items that need review, and leaves superseded ones out', () => {
    const spec = structuredClone(example);
    spec.items = [
      itemSchema.parse({ id: 'REQ-900', type: 'requirement', title: 'Draft one', status: 'draft' }),
      itemSchema.parse({ id: 'REQ-901', type: 'requirement', title: 'Changed upstream', status: 'accepted', needsReview: true }),
      itemSchema.parse({ id: 'REQ-902', type: 'requirement', title: 'Old one', status: 'superseded' }),
    ];
    const { files, dir } = skillOf(spec);
    const text = files[`${dir}/references/items/requirements.md`];
    expect(text).toMatch(/## REQ-900: Draft one\n\nType: requirement · status draft\n/);
    expect(text).toMatch(/## REQ-901: Changed upstream\n\nType: requirement · status accepted · needs review\n/);
    expect(text).not.toContain('REQ-902');
  });

  it('writes no file for a section nobody has touched, says so, and keeps one with typed prose', () => {
    const spec = structuredClone(example);
    const security = section(spec, 'security');
    const discovery = section(spec, 'discovery');
    security.answers = {};
    security.diagram = '';
    security.markdown = renderSection(modules.find((m) => m.id === 'security')!, { answers: {} }, 'en', { projectType: spec.projectType, customQuestions: spec.customQuestions });
    discovery.answers = {};
    discovery.markdown = `${renderSection(modules.find((m) => m.id === 'discovery')!, { answers: {} }, 'en', { projectType: spec.projectType, customQuestions: spec.customQuestions })}\nNotes the team wrote by hand.\n`;
    const { files, dir, path } = skillOf(spec);
    expect(files[`${dir}/references/sections/07-security.md`]).toBeUndefined();
    expect(files[`${dir}/references/sections/01-discovery.md`]).toContain('Notes the team wrote by hand.');
    expect(files[path]).toMatch(/Not specified yet, so there is no file: Security & privacy\. Treat these topics as open\./);
    expect(files[path]).not.toContain('07-security.md');
    expect(auditSkills(files)).toEqual([]);
    // A whole project with no answers lists every section as open and still passes.
    const empty = skillOf(named('Nothing yet'));
    expect(Object.keys(empty.files).filter((p) => p.includes('/sections/'))).toEqual([]);
    expect(empty.files[empty.path]).toContain('Not specified yet, so there is no file: Business & discovery, ');
  });

  it('tells the agent what is binding and what is judgement, with a checklist it can copy', () => {
    const { files, path } = skillOf(example);
    const text = files[path];
    expect(text).toMatch(/```\n- \[ \] 1\. Read references\/product\.md[\s\S]*- \[ \] 7\. [\s\S]*```/);
    expect(text).toMatch(/\*\*Follow exactly:\*\* accepted requirements and decisions, the security checklist/);
    expect(text).toMatch(/\*\*Do not build on:\*\* items marked draft or "needs review"/);
    expect(text).toMatch(/\*\*Use judgement:\*\*/);
    expect(text).toMatch(/If a check fails, fix the change and check again/);
    expect(text).toContain('references/design.md#open-questions');
  });

  it('points a French project at its French "open questions" heading', () => {
    const { files, path, dir } = skillOf(named('Portail de demandes', 'fr'));
    expect(files[path]).toContain('references/design.md#questions-ouvertes');
    expect(files[`${dir}/references/design.md`]).toContain('## Questions ouvertes');
    expect(files[`${dir}/references/design.md`]).toContain('## Sommaire');
  });
});
