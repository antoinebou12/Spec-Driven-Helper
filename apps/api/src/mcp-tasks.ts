import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { db } from './db';
import { audit } from './security';
import { HttpError, type ProjectAccess } from './projects';
import { createTasks, latestBaseline, loadBoard, previewTasks, saveBoard } from './board';
import { serialize } from './exports';
import { readiness } from '../../../packages/shared/src/domain';
import { applyPlanImport, parsePlanTasks } from '../../../packages/shared/src/board';
import { readyCards } from '../../../packages/shared/src/task-plan';

/**
 * MCP tools that read and write the existing project for agents: the whole specification, the
 * proposals, the tasks that are ready, an existing `.plan/tasks.md`, and the split of a correct
 * specification into tasks. The specification itself still changes only through propose_change.
 */
export type TaskToolContext = {
  server: McpServer;
  tokenId: string;
  userId: string;
  read: () => Promise<ProjectAccess>;
  edit: () => Promise<ProjectAccess>;
  /** Wraps a tool body: structured content, readable errors. */
  tool: <A>(run: (args: A) => Promise<Record<string, unknown>>) => (args: A) => Promise<any>;
  untrusted: string;
  cap: (text: string, max?: number) => { text: string; truncated: boolean };
};

const listed = 100;
const ids = (list: string[]) => ({ items: list.slice(0, listed), total: list.length });
const boardRevision = z
  .number()
  .int()
  .nonnegative()
  .optional()
  .describe(
    'Board revision from get_board; required unless dryRun is true, and the call fails if the board changed since',
  );
const dryRun = z.boolean().optional().describe('Report what would change without saving anything');
const idList = z.array(z.string());

export function registerTaskTools(c: TaskToolContext) {
  const { server, tool, untrusted } = c;
  const audited = (action: string, projectId: string, details: Record<string, unknown>) =>
    audit(c.userId, action, projectId, { via: 'mcp', tokenId: c.tokenId, ...details });
  const needRevision = (expected: number | undefined, preview: boolean | undefined) => {
    if (expected === undefined && !preview)
      throw new HttpError(
        400,
        'expectedRevision is required unless dryRun is true; read it with get_board',
      );
    return expected ?? 0;
  };

  server.registerResource(
    'specification',
    'sdd://project/specification.md',
    {
      title: 'Specification',
      description:
        'The whole specification as one Markdown document: every section with its answers, and the traceability matrix',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const p = await c.read();
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/markdown', text: serialize(p.spec, 'markdown') },
        ],
      };
    },
  );

  server.registerTool(
    'list_proposals',
    {
      title: 'Proposals for the specification',
      description: `Use before proposing, to see what was already proposed and what happened to it, newest first, so the same change is not proposed twice. Optionally one status, paged. ${untrusted}`,
      inputSchema: {
        status: z
          .enum(['pending', 'accepted', 'rejected'])
          .optional()
          .describe('Only proposals with this status'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum proposals to return (default 20, at most 50)'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Proposals to skip; use nextOffset from the previous call'),
      },
      outputSchema: {
        total: z.number().int(),
        offset: z.number().int(),
        nextOffset: z.number().int().nullable(),
        proposals: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            origin: z.string(),
            baseRevision: z.number().int(),
            createdAt: z.string(),
            changes: z.number().int(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(
      async ({
        status,
        limit = 20,
        offset = 0,
      }: {
        status?: string;
        limit?: number;
        offset?: number;
      }) => {
        const p = await c.read();
        const filter = { projectId: p.id, ...(status ? { status } : {}) };
        const total = await db.collection('proposals').countDocuments(filter);
        // The store pages with limit only, so read up to the end of the page and drop what was skipped.
        const rows = (
          await db
            .collection('proposals')
            .find(filter, {
              projection: {
                id: 1,
                title: 1,
                status: 1,
                origin: 1,
                baseRevision: 1,
                createdAt: 1,
                changes: 1,
              },
            })
            .sort({ createdAt: -1 })
            .limit(offset + limit)
            .toArray()
        ).slice(offset);
        return {
          total,
          offset,
          nextOffset: offset + limit < total ? offset + limit : null,
          proposals: rows.map((r) => ({
            id: String(r.id),
            title: String(r.title),
            status: String(r.status),
            origin: String(r.origin),
            baseRevision: Number(r.baseRevision),
            createdAt: String(r.createdAt),
            changes: Array.isArray(r.changes) ? r.changes.length : 0,
          })),
        };
      },
    ),
  );

  server.registerTool(
    'get_next_tasks',
    {
      title: 'Next tasks that are ready',
      description: `Use to choose what to work on: cards waiting in "todo" whose dependencies are all done, in plan order, with how many are still blocked. Take one, then call move_card to "doing". Bodies are shortened; read the source items with list_items. ${untrusted}`,
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum tasks to return (default 10, at most 50)'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Tasks to skip; use nextOffset from the previous call'),
      },
      outputSchema: {
        revision: z.number().int(),
        total: z.number().int(),
        offset: z.number().int(),
        nextOffset: z.number().int().nullable(),
        blocked: z.number().int(),
        inProgress: z.number().int(),
        tasks: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            group: z.string(),
            body: z.string(),
            dependsOn: idList,
            sourceIds: idList,
          }),
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    tool(async ({ limit = 10, offset = 0 }: { limit?: number; offset?: number }) => {
      const p = await c.read();
      const board = await loadBoard(p.id);
      const { ready, blocked } = readyCards(board.cards);
      return {
        revision: board.revision,
        total: ready.length,
        offset,
        nextOffset: offset + limit < ready.length ? offset + limit : null,
        blocked: blocked.length,
        inProgress: board.cards.filter((card) => card.column === 'doing').length,
        tasks: ready
          .slice(offset, offset + limit)
          .map((card) => ({
            id: card.id,
            title: card.title,
            group: card.group,
            body: c.cap(card.body, 600).text,
            dependsOn: card.dependsOn,
            sourceIds: card.sourceIds,
          })),
      };
    }),
  );

  server.registerTool(
    'plan_tasks',
    {
      title: 'Split the project into tasks',
      description:
        'Use once a baseline is approved, to split the project into tasks: foundations from the stack, one epic per component, requirements by priority with their tests, use cases after their requirements. Adds the missing cards; existing cards keep their column and pull requests and none is deleted. Refuses until a reviewer has approved a baseline. Lists gaps in the specification; use dryRun to preview.',
      inputSchema: { expectedRevision: boardRevision, dryRun },
      outputSchema: {
        dryRun: z.boolean(),
        baselineRevision: z.number().int(),
        specRevision: z.number().int(),
        behindSpecification: z.boolean(),
        revision: z.number().int(),
        total: z.number().int(),
        added: idList,
        addedTotal: z.number().int(),
        obsolete: idList,
        obsoleteTotal: z.number().int(),
        gaps: idList,
        summary: z.object({
          tasks: z.number().int(),
          epics: z.number().int(),
          foundations: z.number().int(),
          derivedTests: z.number().int(),
          backlog: z.number().int(),
        }),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool(
      async ({
        expectedRevision,
        dryRun: preview,
      }: {
        expectedRevision?: number;
        dryRun?: boolean;
      }) => {
        const p = await c.edit();
        const baseline = await latestBaseline(p.id);
        if (!baseline) {
          const r = readiness(p.spec);
          throw new HttpError(
            409,
            r.ready
              ? 'No baseline is approved yet. The specification looks ready: ask a reviewer to approve a baseline in SDD Studio (Readiness & baselines); tasks are created from it.'
              : `The specification is not correct yet: ${r.blockers.length} blocker${r.blockers.length === 1 ? '' : 's'} (${r.blockers.slice(0, 5).join('; ')}${r.blockers.length > 5 ? '; …' : ''}). Close them with propose_change (see the close_readiness_gaps prompt); then a reviewer approves a baseline and tasks can be planned.`,
          );
        }
        const expected = needRevision(expectedRevision, preview);
        const common = {
          dryRun: !!preview,
          baselineRevision: baseline.revision,
          specRevision: p.spec.revision,
          behindSpecification: p.spec.revision > baseline.revision,
        };
        if (preview) {
          const { board, plan, merged } = await previewTasks(p.id, baseline);
          const a = ids(merged.added);
          const o = ids(merged.obsolete);
          return {
            ...common,
            revision: board.revision,
            total: merged.cards.length,
            added: a.items,
            addedTotal: a.total,
            obsolete: o.items,
            obsoleteTotal: o.total,
            gaps: plan.gaps,
            summary: plan.summary,
          };
        }
        const change = await createTasks(p.id, baseline, expected);
        await audited('board.generated', p.id, {
          baselineId: baseline.id,
          added: change.added.length,
          obsolete: change.obsolete.length,
        });
        const a = ids(change.added);
        const o = ids(change.obsolete);
        return {
          ...common,
          revision: change.revision,
          total: change.total,
          added: a.items,
          addedTotal: a.total,
          obsolete: o.items,
          obsoleteTotal: o.total,
          gaps: change.gaps,
          summary: change.summary,
        };
      },
    ),
  );

  server.registerTool(
    'import_plan_tasks',
    {
      title: 'Import an existing .plan/tasks.md',
      description:
        'Use to bring the repository\'s existing .plan/tasks.md into the board: [x] moves a card to done, [/] to in progress, new lines add cards, "— After:" lines add dependencies. Nothing is deleted and nothing changes in the specification. Use dryRun to preview, then repeat with expectedRevision.',
      inputSchema: {
        markdown: z
          .string()
          .min(1)
          .max(200_000)
          .describe("Contents of the repository's .plan/tasks.md (checkbox tasks under headings)"),
        expectedRevision: boardRevision,
        dryRun,
      },
      outputSchema: {
        dryRun: z.boolean(),
        revision: z.number().int(),
        added: idList,
        addedTotal: z.number().int(),
        updated: idList,
        updatedTotal: z.number().int(),
        skipped: idList,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool(
      async ({
        markdown,
        expectedRevision,
        dryRun: preview,
      }: {
        markdown: string;
        expectedRevision?: number;
        dryRun?: boolean;
      }) => {
        const p = await c.edit();
        const expected = needRevision(expectedRevision, preview);
        const board = await loadBoard(p.id);
        const parsed = parsePlanTasks(markdown);
        const { cards, added, updated } = applyPlanImport(board.cards, parsed.cards);
        const a = ids(added);
        const u = ids(updated);
        let revision = board.revision;
        if (!preview) {
          revision = (await saveBoard(p.id, expected, cards)).revision;
          await audited('board.plan-imported', p.id, {
            added: added.length,
            updated: updated.length,
            skipped: parsed.skipped.length,
          });
        }
        return {
          dryRun: !!preview,
          revision,
          added: a.items,
          addedTotal: a.total,
          updated: u.items,
          updatedTotal: u.total,
          skipped: parsed.skipped.slice(0, listed),
        };
      },
    ),
  );

  server.registerPrompt(
    'break_into_tasks',
    {
      title: 'Split the project into tasks',
      description:
        'Guides an agent to split a correct specification into board tasks: check it is correct, preview the plan, report the gaps it shows, then create the tasks.',
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Split this SDD Studio project into tasks once its specification is correct.',
              '1. Call get_project_overview. If readiness has blockers or latestBaseline is null, the specification is not correct yet: follow the close_readiness_gaps prompt and stop. Only a reviewer approves a baseline.',
              '2. Call get_board for its revision, then plan_tasks with dryRun true. Read added, obsolete and gaps.',
              '3. If a gap shows the specification is wrong or incomplete (a requirement without a component or acceptance criteria), call propose_change with the evidence. Do not hide gaps.',
              '4. Call plan_tasks with expectedRevision to create the tasks, then get_next_tasks to see what can start.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
