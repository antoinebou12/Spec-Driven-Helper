import { lazy, Suspense } from 'react';
import { can } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';
import { useFeatures } from '../features';
import { useL } from '../i18n';

const McpAccess = lazy(() => import('./McpAccess'));
const Connectors = lazy(() => import('./Connectors'));

export function ProjectIntegrations({
  project,
  notify,
}: {
  project: ProjectState;
  notify: (message: string) => void;
}) {
  const l = useL();
  const features = useFeatures();
  const spec = project.spec!;
  const admin = can(project.role, 'admin');
  return (
    <div className="form-stack">
      {features.on('mcp') && (
        <section className="settings-section" aria-labelledby="mcp-title">
          <h3 id="mcp-title">{l('Coding agents (MCP)', 'Agents de code (MCP)')}</h3>
          <Suspense fallback={<p role="status">{l('Loading…', 'Chargement…')}</p>}>
            <McpAccess
              key={spec.id}
              projectId={spec.id}
              admin={admin}
              localOnly={spec.localOnly}
              notify={notify}
            />
          </Suspense>
        </section>
      )}
      {features.on('connectors') && (
        <section className="settings-section" aria-labelledby="connectors-title">
          <h3 id="connectors-title">{l('Connectors', 'Connecteurs')}</h3>
          <Suspense fallback={<p role="status">{l('Loading…', 'Chargement…')}</p>}>
            <Connectors
              key={spec.id}
              projectId={spec.id}
              admin={admin}
              editable={can(project.role, 'edit')}
              notify={notify}
              onError={notify}
            />
          </Suspense>
        </section>
      )}
    </div>
  );
}
