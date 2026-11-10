import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

/** The only tools an agent session may use: read-only inspection of its own workspace. */
export const allowedTools = ['Read', 'Glob', 'Grep'] as const;
export const deniedTools = [
  'Bash',
  'BashOutput',
  'KillShell',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Task',
  'Agent',
  'Skill',
  'TodoWrite',
];
export const limits = {
  files: 5000,
  totalBytes: 40_000_000,
  fileBytes: 2_000_000,
};

export type ToolDecision = { decision: 'allow' | 'deny'; reason?: string; target: string };

// Drive letters, UNC and home paths are refused on every platform: on Linux `C:\x` would
// otherwise resolve as a relative file name inside the workspace.
const foreignRoot = (path: string) => /^[a-zA-Z]:|^\\\\|^~/.test(path);
const escapes = (pattern: string) => pattern.includes('..') || isAbsolute(pattern) || foreignRoot(pattern);
function inside(workspace: string, path: string) {
  if (!isAbsolute(path) && foreignRoot(path)) return false;
  const root = resolve(workspace);
  const target = resolve(root, path);
  return target === root || target.startsWith(root + sep);
}

/**
 * Decides whether a tool call stays inside the disposable workspace. Called from a PreToolUse
 * hook, which runs for every call regardless of permission mode or pre-approved tools.
 */
export function toolDecision(tool: string, input: unknown, workspace: string): ToolDecision {
  const args = (input ?? {}) as Record<string, unknown>;
  const fields = ['file_path', 'path', 'pattern', 'glob', 'notebook_path']
    .map((k) => (typeof args[k] === 'string' ? (args[k] as string) : undefined))
    .filter((v): v is string => v !== undefined);
  const target = fields.join(' ') || '.';
  if (!(allowedTools as readonly string[]).includes(tool))
    return { decision: 'deny', reason: `${tool} is not available in isolated specification runs`, target };
  for (const key of ['file_path', 'path', 'notebook_path'])
    if (typeof args[key] === 'string' && !inside(workspace, args[key] as string))
      return { decision: 'deny', reason: 'Path is outside the session workspace', target };
  for (const key of ['pattern', 'glob'])
    if (tool !== 'Grep' || key === 'glob')
      if (typeof args[key] === 'string' && escapes(args[key] as string))
        return { decision: 'deny', reason: 'Pattern escapes the session workspace', target };
  return { decision: 'allow', target };
}

/** Writes project material into the workspace, rejecting any path that could escape it. */
export async function writeWorkspace(workspace: string, files: Record<string, string>) {
  const entries = Object.entries(files);
  if (entries.length > limits.files) throw new Error('Too many files for one session');
  let total = 0;
  for (const [path, content] of entries) {
    if (!path || path.includes('\0') || path.includes('\\') || escapes(path) || !inside(workspace, path))
      throw new Error(`Unsafe workspace path: ${path.slice(0, 200)}`);
    const size = Buffer.byteLength(content);
    if (size > limits.fileBytes || (total += size) > limits.totalBytes)
      throw new Error('Session material exceeds the size limit');
    const target = resolve(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { mode: 0o600, flag: 'wx' });
  }
}

/** Environment for the agent process: nothing from the host except what the SDK needs. */
export function agentEnvironment(workspace: string, source: NodeJS.ProcessEnv = process.env) {
  const env: Record<string, string> = {
    PATH: source.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: workspace,
    TMPDIR: workspace,
    CLAUDE_AGENT_SDK_CLIENT_APP: 'sdd-studio-agent-runner/1',
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
  };
  for (const key of ['ANTHROPIC_API_KEY', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'SYSTEMROOT'])
    if (source[key]) env[key] = source[key]!;
  return env;
}
