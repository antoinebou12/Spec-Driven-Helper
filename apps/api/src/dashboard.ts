import type { FastifyInstance } from 'fastify';
import { db } from './db';
import type { Auth } from './auth-types';
import { can, readiness } from '../../../packages/shared/src/domain';
import { completeness } from '../../../packages/shared/src/completeness';
import { securityChecklist } from '../../../packages/shared/src/security-checklist';
import { boardColumns } from '../../../packages/shared/src/board';
import type { Role, Spec } from '../../../packages/shared/src/schema';

/**
 * Role-aware workspace dashboard: every project the user may read, with progress, and what is
 * waiting for them. Reviewers see what needs review; editors see blockers and open questions;
 * viewers see the same progress read-only. Nothing here can change a project.
 */
export async function registerDashboard(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/dashboard', { preHandler: auth }, async (req: any) => {
    const query = req.user.role === 'Owner' ? {} : { [`members.${req.user.id}`]: { $exists: true } };
    const projects = await db.collection('projects').find(query, { projection: { _id: 0, id: 1, spec: 1, members: 1 } }).toArray();
    const ids = projects.map((p) => p.id as string);
    const [proposals, boards, baselines] = await Promise.all([
      db.collection('proposals').find({ projectId: { $in: ids }, status: 'pending' }, { projection: { _id: 0, projectId: 1 } }).toArray(),
      db.collection('boards').find({ projectId: { $in: ids } }, { projection: { _id: 0, projectId: 1, cards: 1 } }).toArray(),
      db.collection('baselines').find({ projectId: { $in: ids } }, { projection: { _id: 0, projectId: 1, revision: 1, approvedAt: 1 } }).toArray(),
    ]);
    const rows = projects.map((p) => {
      const spec = p.spec as Spec;
      const role = (req.user.role === 'Owner' ? 'Owner' : p.members[req.user.id]) as Role;
      const r = readiness(spec);
      const board = boards.find((b) => b.projectId === p.id);
      const latest = baselines.filter((b) => b.projectId === p.id).sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0];
      const unknown = spec.sections.reduce((n, s) => n + Object.values(s.answers).filter((a) => a.state === 'unknown').length, 0);
      const toReview = spec.sections.filter((s) => s.status !== 'reviewed').length;
      return {
        id: p.id as string,
        name: spec.name,
        projectType: spec.projectType,
        role,
        canEdit: can(role, 'edit'),
        canReview: can(role, 'review'),
        revision: spec.revision,
        updatedAt: spec.updatedAt,
        completeness: completeness(spec).percent,
        readiness: { ready: r.ready, percent: r.percent, blockers: r.blockers.length },
        security: securityChecklist(spec).score,
        pendingProposals: proposals.filter((x) => x.projectId === p.id).length,
        unknownAnswers: unknown,
        sectionsToReview: toReview,
        board: board ? Object.fromEntries(boardColumns.map((c) => [c, (board.cards as { column: string }[]).filter((x) => x.column === c).length])) : null,
        latestBaseline: latest ? { revision: latest.revision as number, approvedAt: latest.approvedAt as string } : null,
      };
    });
    rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const reviewer = rows.filter((r) => r.canReview);
    const editor = rows.filter((r) => r.canEdit);
    return {
      user: { name: req.user.name, role: req.user.role },
      totals: {
        projects: rows.length,
        ready: rows.filter((r) => r.readiness.ready).length,
        withBaseline: rows.filter((r) => r.latestBaseline).length,
        averageCompleteness: rows.length ? Math.round(rows.reduce((n, r) => n + r.completeness, 0) / rows.length) : 0,
      },
      // What is waiting for this user, by role.
      waiting: {
        proposalsToReview: reviewer.reduce((n, r) => n + r.pendingProposals, 0),
        sectionsToReview: reviewer.reduce((n, r) => n + r.sectionsToReview, 0),
        openQuestions: editor.reduce((n, r) => n + r.unknownAnswers, 0),
        blockers: editor.reduce((n, r) => n + r.readiness.blockers, 0),
      },
      readOnly: !rows.some((r) => r.canEdit || r.canReview),
      projects: rows,
    };
  });
}
