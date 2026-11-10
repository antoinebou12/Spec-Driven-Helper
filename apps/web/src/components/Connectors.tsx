import { useCallback, useEffect, useState } from 'react';
import { useLatest } from '../hooks';
import { api } from '../api';
import { Button, Badge, Modal } from './ui';
import { modules } from '../../../../packages/shared/src/templates';
export default function Connectors({
  projectId,
  admin,
  editable,
  notify,
  onError,
}: {
  projectId: string;
  admin: boolean;
  editable: boolean;
  notify: (s: string) => void;
  onError: (s: string) => void;
}) {
  const [list, setList] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [mode, setMode] = useState('configure');
  const reload = useCallback(() => api(`/projects/${projectId}/connectors`).then(setList), [projectId]);
  const errorHandler = useLatest(onError);
  useEffect(() => {
    reload().catch((e) => errorHandler.current(e.message));
  }, [reload, errorHandler]);
  return (
    <>
      <p>
        Import external references as proposals. Issue publishing sends only the title and body you
        review below.
      </p>
      {list.map((c) => (
        <div className="list-row" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            <small>{c.description}</small>
          </div>
          <div className="inline-actions">
            <Badge tone={c.status === 'configured' ? 'green' : 'neutral'}>{c.status}</Badge>
            {admin && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(c);
                  setMode('configure');
                }}
              >
                Configure
              </Button>
            )}
            <Button
              disabled={!editable || c.status !== 'configured'}
              onClick={() => {
                setSelected(c);
                setMode('read');
              }}
            >
              Import
            </Button>
            {c.capabilities.includes('publish') && (
              <Button
                disabled={!editable || c.status !== 'configured'}
                onClick={() => {
                  setSelected(c);
                  setMode('publish');
                }}
              >
                Create issue
              </Button>
            )}
          </div>
        </div>
      ))}
      <Modal
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title={`${selected?.name ?? ''} · ${mode}`}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              if (mode === 'configure')
                await api(`/projects/${projectId}/connectors/${selected.id}`, 'PUT', {
                  secret: f.get('secret'),
                  site: f.get('site') || undefined,
                  email: f.get('email') || undefined,
                });
              else if (mode === 'read')
                await api(`/projects/${projectId}/connectors/${selected.id}/read`, 'POST', {
                  reference: f.get('reference'),
                  sectionId: f.get('sectionId'),
                });
              else
                await api(`/projects/${projectId}/connectors/${selected.id}/publish`, 'POST', {
                  destination: f.get('destination'),
                  title: f.get('title'),
                  body: f.get('body'),
                  confirmed: f.get('confirmed') === 'on',
                });
              await reload();
              notify(
                mode === 'read'
                  ? 'Source imported as a proposal for review.'
                  : mode === 'publish'
                    ? 'Issue creation request completed.'
                    : 'Connector configured.',
              );
              setSelected(null);
            } catch (e) {
              onError((e as Error).message);
            }
          }}
        >
          {mode === 'configure' ? (
            <>
              <label>
                Credential / access token
                <input type="password" name="secret" autoComplete="new-password" required />
              </label>
              {['jira', 'confluence', 'mcp'].includes(selected?.id) && (
                <label>
                  Site / MCP endpoint
                  <input name="site" type="url" defaultValue={selected?.site} required />
                </label>
              )}
              {['jira', 'confluence'].includes(selected?.id) && (
                <label>
                  Atlassian email
                  <input name="email" type="email" required />
                </label>
              )}
              {selected?.id === 'google-drive' && (
                <p className="muted">
                  Use a Google OAuth access token with read access. Token refresh is managed by your
                  operator; expired tokens must be replaced.
                </p>
              )}
              {selected?.id === 'mcp' && (
                <p className="muted">
                  The server operator must allowlist this HTTPS origin. Only resource reads are
                  enabled; tools cannot execute.
                </p>
              )}
            </>
          ) : mode === 'read' ? (
            <>
              <label>
                Source identifier
                <input
                  name="reference"
                  placeholder={
                    selected?.id === 'gitlab'
                      ? 'project-id:path/to/file'
                      : 'Issue ID, page ID, file key or resource URI'
                  }
                  required
                />
              </label>
              <label>
                Import into section
                <select name="sectionId">
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title.en}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Destination project / team
                <input name="destination" required />
              </label>
              <label>
                Issue title
                <input name="title" required />
              </label>
              <label>
                Issue body
                <textarea name="body" rows={6} />
              </label>
              <label className="check-label">
                <input name="confirmed" type="checkbox" required />
                Create this issue in the external service.
              </label>
            </>
          )}
          <Button type="submit" variant="primary">
            {mode === 'configure'
              ? 'Save connection'
              : mode === 'read'
                ? 'Import for review'
                : 'Create external issue'}
          </Button>
        </form>
      </Modal>
    </>
  );
}

