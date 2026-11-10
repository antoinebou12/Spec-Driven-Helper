/**
 * Checks an agent skill (a folder with SKILL.md and optional reference files) against Anthropic's
 * skill authoring best practices:
 * https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
 *
 * Pure: it takes `path → text` and returns findings, so it serves this repository's own skills, the
 * skills SDD Studio generates for a project, and any folder someone points `pnpm skills:check` at.
 * Errors break a documented rule or make a skill hard to use; warnings are advice.
 */
export type SkillFinding = { rule: string; severity: 'error' | 'warning'; file: string; message: string };
export type SkillFiles = Record<string, string>;

export const skillLimits = { name: 64, description: 1024, bodyLines: 500, referenceLines: 100 } as const;

const reservedNames = ['anthropic', 'claude'];
const vagueNames = new Set(['helper', 'helpers', 'util', 'utils', 'tool', 'tools', 'document', 'documents', 'data', 'file', 'files', 'misc', 'stuff']);
const months = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const bundleDirs = 'references?|scripts|assets|examples|templates|resources';
const contentsHeading = /^#{1,6}\s*(?:contents|table of contents|sommaire|table des mati[èe]res)\b/im;

/** A frontmatter value as YAML reads it: quoted strings unquoted, `>` and `|` blocks joined. */
function yamlValue(raw: string) {
  if (raw.startsWith('"')) {
    try {
      return String(JSON.parse(raw));
    } catch {
      return raw.replace(/^"|"$/g, '');
    }
  }
  return raw.startsWith("'") ? raw.replace(/^'|'$/g, '').replace(/''/g, "'") : raw;
}

/** Frontmatter keys (`meta`, as YAML reads them; `raw`, as written) and the body below it. */
export function parseSkill(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return undefined;
  const meta: Record<string, string> = {};
  const raw: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const pair = /^([\w-]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!pair) continue;
    const [, key, written] = pair;
    raw[key] = written.trim();
    if (/^[>|][+-]?$/.test(raw[key])) {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) block.push(lines[++i].trim());
      meta[key] = block.join(raw[key].startsWith('>') ? ' ' : '\n').trim();
    } else meta[key] = yamlValue(raw[key]);
  }
  return { meta, raw, body: match[2] };
}

/** Why a value written without quotes would not read back as the same text in YAML, if it would not. */
const yamlProblem = (raw: string) =>
  /^["']/.test(raw) || /^[>|][+-]?$/.test(raw) ? undefined : /: |:$/.test(raw) ? 'contains “: ”' : / #/.test(raw) ? 'contains “ #”' : /^[[\]{}&*!|>%@`]|^[-?:](?:\s|$)/.test(raw) ? 'starts with a YAML indicator character' : undefined;

/**
 * A skill another tool writes and refreshes (OpenSpec's `openspec init` records `generatedBy` under
 * `metadata`). Editing it by hand is pointless, since the tool rewrites it, and its copies for
 * different agents differ on purpose, so a repository's own checks leave such skills alone.
 */
export const isGeneratedSkill = (skillMarkdown: string) => /^---\r?\n[\s\S]*?\r?\n[ \t]+generatedBy:[ \t]*\S[\s\S]*?\r?\n---/.test(skillMarkdown);

/** Every folder that holds a SKILL.md, with the files below it keyed relative to that folder. */
export function skillsIn(files: SkillFiles): { dir: string; files: SkillFiles }[] {
  return Object.keys(files)
    .filter((path) => path === 'SKILL.md' || path.endsWith('/SKILL.md'))
    .map((path) => {
      const dir = path.slice(0, -'SKILL.md'.length).replace(/\/$/, '');
      const prefix = dir ? `${dir}/` : '';
      return { dir, files: Object.fromEntries(Object.entries(files).filter(([p]) => p.startsWith(prefix)).map(([p, text]) => [p.slice(prefix.length), text])) };
    });
}

/** A link target resolved against the file that holds it; undefined when it leaves the skill folder. */
/**
 * The skills a repository writes itself: the files inside skill folders, without the skills another
 * tool generates (those are listed in `generated`) and without loose files beside them.
 */
export function repositorySkills(files: SkillFiles) {
  const all = skillsIn(files);
  const generated = all.filter((s) => isGeneratedSkill(s.files['SKILL.md'] ?? '')).map((s) => s.dir);
  const own = all.filter((s) => !generated.includes(s.dir)).map((s) => `${s.dir}/`);
  return { files: Object.fromEntries(Object.entries(files).filter(([path]) => own.some((dir) => path.startsWith(dir)))), generated };
}

const normalize = (from: string, target: string) => {
  const parts = from.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') {
      if (!parts.length) return undefined;
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
};

/** Relative files a text points to: Markdown links, and bundle paths such as references/guide.md. */
function pointers(file: string, text: string, known: Set<string>) {
  const found = new Set<string>();
  for (const m of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(m[1]) ? undefined : normalize(file, m[1]);
    if (target) found.add(target);
  }
  for (const m of text.matchAll(new RegExp(`(?<![\\w./-])((?:${bundleDirs})/[\\w./-]*[\\w-]\\.[A-Za-z0-9]+)`, 'g'))) found.add(m[1]);
  return { found, existing: [...found].filter((p) => known.has(p)) };
}

export function auditSkill(dir: string, files: SkillFiles): SkillFinding[] {
  const findings: SkillFinding[] = [];
  const at = (file: string) => (dir ? `${dir}/${file}` : file);
  const add = (severity: SkillFinding['severity'], rule: string, file: string, message: string) => findings.push({ severity, rule, file: at(file), message });
  const parsed = parseSkill(files['SKILL.md'] ?? '');
  if (!parsed) {
    add('error', 'frontmatter', 'SKILL.md', 'SKILL.md must start with YAML frontmatter (--- name and description ---).');
    return findings;
  }
  const { meta, raw, body } = parsed;
  for (const key of ['name', 'description']) {
    const problem = yamlProblem(raw[key] ?? '');
    if (problem) add('error', 'frontmatter-yaml', 'SKILL.md', `The ${key} ${problem}, so YAML will not read it as written. Rephrase it or wrap it in double quotes.`);
  }

  // Name
  const name = meta.name ?? '';
  if (!name) add('error', 'name', 'SKILL.md', 'The frontmatter needs a name.');
  else {
    if (name.length > skillLimits.name) add('error', 'name', 'SKILL.md', `The name is ${name.length} characters; the limit is ${skillLimits.name}.`);
    if (!/^[a-z0-9-]+$/.test(name)) add('error', 'name', 'SKILL.md', 'The name may contain only lowercase letters, numbers and hyphens (no spaces, capitals or tags).');
    const reserved = reservedNames.find((w) => name.toLowerCase().includes(w));
    if (reserved) add('error', 'name-reserved', 'SKILL.md', `The name must not contain the reserved word “${reserved}”.`);
    if (dir && name !== dir.split('/').pop()) add('error', 'name-directory', 'SKILL.md', `The name “${name}” must match its folder “${dir.split('/').pop()}”.`);
    if (/^-|-$|--/.test(name)) add('warning', 'name-hyphens', 'SKILL.md', 'The name should not start or end with a hyphen or contain two in a row.');
    if (name.split('-').every((w) => vagueNames.has(w))) add('warning', 'name-vague', 'SKILL.md', `“${name}” is too generic to tell skills apart; name the activity (for example processing-pdfs).`);
  }

  // Description: the only text Claude sees before it decides to load the skill.
  const description = meta.description ?? '';
  if (!description.trim()) add('error', 'description', 'SKILL.md', 'The frontmatter needs a non-empty description.');
  else {
    if (description.length > skillLimits.description) add('error', 'description', 'SKILL.md', `The description is ${description.length} characters; the limit is ${skillLimits.description}.`);
    if (/<\/?[a-z][^>]*>/i.test(description)) add('error', 'description-tags', 'SKILL.md', 'The description must not contain XML or HTML tags.');
    if (/\b(?:I|I'm|I'll|I've)\b/.test(description) || /\b(?:you|your|you'll|we|our|my)\b/i.test(description))
      add('error', 'description-person', 'SKILL.md', 'Write the description in the third person (“Extracts text…”, not “I can…” or “You can…”): it is injected into the system prompt.');
    if (!/\bwhen\b|\buse (?:it |this )?(?:for|if|to)\b/i.test(description)) add('error', 'description-when', 'SKILL.md', 'The description must say when to use the skill (for example “Use when …”), not only what it does.');
    if (description.trim().length < 40) add('warning', 'description-vague', 'SKILL.md', 'The description is very short; name the key terms and triggers Claude should recognise.');
    if (new RegExp(`\\brevision\\s+\\d+|\\brev\\.?\\s*\\d+|\\br\\d+\\b|\\b20\\d\\d-\\d\\d-\\d\\d\\b|\\b${months}\\s+\\d{4}\\b`, 'i').test(description))
      add('warning', 'volatile', 'SKILL.md', 'The description holds a revision or date that changes; move it into the body so the description stays stable.');
  }

  // Body
  const bodyLines = body.replace(/\s+$/, '').split('\n').length;
  if (bodyLines > skillLimits.bodyLines) add('error', 'body-length', 'SKILL.md', `The body is ${bodyLines} lines; keep it under ${skillLimits.bodyLines} and move detail into reference files.`);
  if (new RegExp(`\\b(?:before|after|until|since|as of)\\s+(?:${months}\\s+)?20\\d\\d\\b`, 'i').test(body))
    add('warning', 'volatile', 'SKILL.md', 'Time-dependent wording (“before 2025…”) goes stale; describe the current method and keep old ones in a clearly marked “old patterns” section.');
  if (new RegExp(`\\b(?:[\\w.-]+\\\\)+[\\w.-]+\\.(?:md|py|js|mjs|ts|json|sh|txt|ya?ml)\\b`).test(body)) add('error', 'path-windows', 'SKILL.md', 'Use forward slashes in file paths; backslashes fail on other systems.');
  const steps = (body.match(/^\s*\d+\.\s+\S/gm) ?? []).length;
  const checklist = /^\s*[-*]\s+\[[ xX]\]/m.test(body);
  if (steps >= 5 && !checklist) add('warning', 'checklist', 'SKILL.md', `A ${steps}-step workflow works better with a copyable progress checklist (“- [ ] step”) the agent can tick off.`);
  if ((steps >= 5 || checklist) && !/\b(?:repeat|re-?run|rerun|return to|go back|until|loop|stop and|fix(?:ed)? (?:it|them|the|any|each)|if (?:it|they|any|the|a)\b[^.\n]*\b(?:fail|fails|failed|error|errors|differ|differs|mismatch|conflict|contradicts?))/i.test(body))
    add('warning', 'feedback-loop', 'SKILL.md', 'Add a check-fix-repeat step (“if a check fails, fix it and run it again before continuing”) so mistakes are caught before they spread.');

  // Bundled files: reachable, present, one level deep, and previewable.
  const known = new Set(Object.keys(files));
  const fromSkill = pointers('SKILL.md', body, known);
  for (const path of fromSkill.found) {
    const bundled = new RegExp(`^(?:${bundleDirs})/`).test(path) || /\.md$/i.test(path);
    if (bundled && !known.has(path)) add('error', 'reference-missing', 'SKILL.md', `SKILL.md points to ${path}, which is not in the skill.`);
  }
  const others = Object.keys(files).filter((p) => p !== 'SKILL.md');
  // A file is found by its path, or by naming its folder on its own (“the files in references/sections/”).
  const folderMentioned = (path: string) => {
    const folder = path.split('/').slice(0, -1).join('/');
    return !!folder && new RegExp(`(?<![\\w./-])${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?![\\w/-]|\\.\\w)`).test(body);
  };
  for (const path of others)
    if (!fromSkill.found.has(path) && !body.includes(path) && !folderMentioned(path))
      add('error', 'reference-orphan', path, 'SKILL.md never mentions this file, so Claude cannot discover it. Link it from SKILL.md.');
  const baseNames = others.filter((p) => /\.md$/i.test(p) && p.split('/').pop()!.length >= 6).map((p) => ({ path: p, base: p.split('/').pop()! }));
  for (const path of others.filter((p) => /\.md$/i.test(p))) {
    const text = files[path];
    const nested = new Set(pointers(path, text, known).existing.filter((p) => p !== path));
    for (const { path: other, base } of baseNames)
      if (other !== path && new RegExp(`(?<![\\w-])${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(text)) nested.add(other);
    for (const other of nested) add('error', 'reference-nested', path, `Points to ${other}. Keep references one level deep: link every file from SKILL.md, because Claude only previews files it reaches through other files.`);
    if (text.split('\n').length > skillLimits.referenceLines && !contentsHeading.test(text.split('\n').slice(0, 40).join('\n')))
      add('error', 'reference-contents', path, `This file is over ${skillLimits.referenceLines} lines and has no contents list at the top; a partial read would not show what it covers.`);
  }
  if (others.some((p) => p.startsWith('scripts/')) && !/install|require|dependenc/i.test(body))
    add('warning', 'dependencies', 'SKILL.md', 'The skill bundles scripts but SKILL.md does not say which packages or tools they need; list them and how to install them.');
  return findings;
}

/** Audits every skill found in a `path → text` map. */
export function auditSkills(files: SkillFiles): SkillFinding[] {
  return skillsIn(files).flatMap(({ dir, files: own }) => auditSkill(dir, own));
}
