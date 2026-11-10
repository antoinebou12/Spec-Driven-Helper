import { toString } from 'mdast-util-to-string';
import { markdownTree } from './openspec-format';

export function taskConsistency(plan: string, changes: Record<string, string>): string[] {
  const states = new Map(
    [...plan.matchAll(/^\s*- \[([ x/])\] (TASK-\d+)\b/gm)].map((m) => [m[2], m[1] === 'x']),
  );
  const errors: string[] = [];
  for (const [path, markdown] of Object.entries(changes)) {
    let count = 0;
    for (const node of markdownTree(markdown).children) {
      if (node.type !== 'list') continue;
      for (const task of node.children) {
        const text = toString(task);
        const mark = /^\[\s*([^\]]*?)\s*\]\s+/.exec(text);
        if (!mark) continue;
        count++;
        const ids = [...text.matchAll(/\bTASK-\d+\b/g)].map((m) => m[0]);
        if (ids.length !== 1 || !states.has(ids[0]))
          errors.push(`${path}: task must reference exactly one existing TASK-###`);
        else if (/^x$/i.test(mark[1]) !== states.get(ids[0]))
          errors.push(`${path}: ${ids[0]} completion differs from .plan/tasks.md`);
      }
    }
    if (!count) errors.push(`${path}: no tracked tasks`);
  }
  return errors;
}
