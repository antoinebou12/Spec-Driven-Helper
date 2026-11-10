import { useCallback, useEffect, useState } from 'react';
import { Bot, Copy, KeyRound, Trash2 } from 'lucide-react';
import { api, ApiError } from '../api';
import { Button, EmptyState, Modal } from './ui';
import { formatDate, useL, useLang } from '../i18n';

type Token = { id: string; name: string; createdAt: string; createdBy: string; lastUsedAt?: string };
type Created = Token & { token: string; endpoint: string };

/** Project MCP tokens for coding agents; the secret is shown once, right after creation. */
export default function McpAccess({ projectId, admin, localOnly, notify }: { projectId: string; admin: boolean; localOnly: boolean; notify: (m: string) => void }) {
  const l = useL();
  const lang = useLang();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState('Claude Code');
  const [confirmLocal, setConfirmLocal] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState('');
  const endpoint = `${location.origin}/api/v1/mcp`;

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      setTokens((await api<{ tokens: Token[] }>(`/projects/${projectId}/mcp/tokens`)).tokens);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [admin, projectId]);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setError('');
    try {
      setCreated(await api<Created>(`/projects/${projectId}/mcp/tokens`, 'POST', { name, confirmLocalOnly: confirmLocal }));
      setConfirmLocal(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError && e.details.requiresConfirmation ? l('Confirm the local-only warning first.', 'Confirmez d’abord l’avertissement local.') : (e as Error).message);
    }
  };
  const revoke = async (token: Token) => {
    setError('');
    try {
      await api(`/projects/${projectId}/mcp/tokens/${token.id}`, 'DELETE');
      notify(l(`Token “${token.name}” revoked.`, `Jeton « ${token.name} » révoqué.`));
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const copy = (value: string, what: string) => navigator.clipboard.writeText(value).then(() => notify(l(`${what} copied.`, `${what} copié.`)));
  const command = (token: string) => `claude mcp add --transport http sdd-studio ${endpoint} --header "Authorization: Bearer ${token}"`;

  return (
    <div className="form-stack mcp-access">
      <p className="muted small">
        {l(
          'Coding agents (Claude Code, Codex, Copilot) connect over MCP to read this specification and the board, move cards, link pull requests and propose changes. Proposals still need a reviewer; tokens act with your editing rights and stop working if you lose them.',
          'Les agents de code (Claude Code, Codex, Copilot) se connectent par MCP pour lire la spécification et le tableau, déplacer des cartes, lier des demandes de fusion et proposer des changements. Les propositions exigent toujours une révision; les jetons agissent avec vos droits d’édition.',
        )}
      </p>
      <p className="small">
        {l('Endpoint', 'Point d’accès')} <code>{endpoint}</code>
      </p>
      {!admin ? (
        <p className="muted small">{l('Project owners and admins create tokens.', 'Les propriétaires et administrateurs créent les jetons.')}</p>
      ) : (
        <>
          <form
            className="inline-actions"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label>
              <span className="sr-only">{l('Token name', 'Nom du jeton')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required placeholder={l('Token name', 'Nom du jeton')} />
            </label>
            <Button type="submit" disabled={!name.trim() || (localOnly && !confirmLocal)}>
              <KeyRound size={15} aria-hidden /> {l('Create token', 'Créer un jeton')}
            </Button>
          </form>
          {localOnly && (
            <label className="check-label">
              <input type="checkbox" checked={confirmLocal} onChange={(e) => setConfirmLocal(e.target.checked)} />
              <span>
                {l(
                  'This project is local-only. I confirm the agent using this token runs where this specification may be shared.',
                  'Ce projet est local. Je confirme que l’agent utilisant ce jeton s’exécute là où cette spécification peut être partagée.',
                )}
              </span>
            </label>
          )}
          {tokens.length ? (
            <table className="data-table compact">
              <caption className="sr-only">{l('Active MCP tokens', 'Jetons MCP actifs')}</caption>
              <thead>
                <tr>
                  <th scope="col">{l('Name', 'Nom')}</th>
                  <th scope="col">{l('Created', 'Créé')}</th>
                  <th scope="col">{l('Last used', 'Dernière utilisation')}</th>
                  <th scope="col">
                    <span className="sr-only">{l('Actions', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{formatDate(t.createdAt, lang)}</td>
                    <td>{t.lastUsedAt ? formatDate(t.lastUsedAt, lang) : l('Never', 'Jamais')}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => void revoke(t)} aria-label={l(`Revoke ${t.name}`, `Révoquer ${t.name}`)}>
                        <Trash2 size={14} aria-hidden /> {l('Revoke', 'Révoquer')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<Bot size={24} aria-hidden />} title={l('No agent tokens yet', 'Aucun jeton d’agent')} />
          )}
        </>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {created && (
        <Modal open onOpenChange={() => setCreated(null)} title={l(`Token “${created.name}” created`, `Jeton « ${created.name} » créé`)}>
          <div className="form-stack">
            <p role="status">{l('Copy it now: it is shown only once and cannot be recovered.', 'Copiez-le maintenant : il ne sera plus affiché.')}</p>
            <pre className="mono token-value">{created.token}</pre>
            <Button onClick={() => void copy(created.token, l('Token', 'Jeton'))}>
              <Copy size={15} aria-hidden /> {l('Copy token', 'Copier le jeton')}
            </Button>
            <p className="small">{l('Claude Code:', 'Claude Code :')}</p>
            <pre className="mono token-value">{command(created.token)}</pre>
            <Button onClick={() => void copy(command(created.token), l('Command', 'Commande'))}>
              <Copy size={15} aria-hidden /> {l('Copy command', 'Copier la commande')}
            </Button>
            <div className="modal-actions">
              <Button variant="primary" onClick={() => setCreated(null)}>
                {l('Done', 'Terminé')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
