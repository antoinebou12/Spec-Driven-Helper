import { useState } from 'react';
import { CheckCircle2, Cpu, RefreshCw, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { useL } from '../i18n';
import { Badge, Button } from './ui';

export type OllamaModel = {
  name: string;
  size: number;
  loaded: boolean;
  contextLength?: number;
  capabilities: string[];
  family?: string;
  parameterSize?: string;
};
export type OllamaReport =
  | {
      reachable: true;
      url: string;
      version: string;
      numCtx: number;
      models: OllamaModel[];
      chatModel?: { name: string; installed?: boolean };
      embeddingModel?: { name: string; installed?: boolean };
    }
  | { reachable: false; url: string; numCtx: number; error: string };

const gigabytes = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

/** Administrator check of the local model server: reachability, installed models and their limits. */
export function OllamaStatus({
  initial,
  load = () => api<OllamaReport>('/integrations/ollama/status'),
}: {
  initial?: OllamaReport;
  load?: () => Promise<OllamaReport>;
}) {
  const l = useL();
  const [report, setReport] = useState<OllamaReport | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const check = async () => {
    setBusy(true);
    setError('');
    try {
      setReport(await load());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const missing = (label: string, model?: { name: string; installed?: boolean }) =>
    model && !model.installed ? (
      <li>
        <TriangleAlert size={14} aria-hidden /> {label} <code>{model.name}</code>{' '}
        {l('is not installed. Run', 'n’est pas installé. Exécutez')}{' '}
        <code>ollama pull {model.name}</code>
      </li>
    ) : null;
  return (
    <section className="card form-stack ollama-status" aria-labelledby="ollama-status-title">
      <div className="row-between">
        <h3 id="ollama-status-title">
          <Cpu size={16} aria-hidden /> {l('Local AI (Ollama)', 'IA locale (Ollama)')}
        </h3>
        <Button size="sm" onClick={check} disabled={busy}>
          <RefreshCw size={14} aria-hidden className={busy ? 'spin' : undefined} />{' '}
          {report
            ? l('Check again', 'Vérifier de nouveau')
            : l('Check connection', 'Vérifier la connexion')}
        </Button>
      </div>
      <p className="muted small">
        {l(
          'Local-only projects use this server and never fall back to the cloud. Models whose context window is smaller than the specification receive a compact context focused on the sections a request names.',
          'Les projets locaux utilisent ce serveur, sans repli infonuagique. Les modèles dont la fenêtre de contexte est plus petite que la spécification reçoivent un contexte compact centré sur les sections demandées.',
        )}
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {report && !report.reachable && (
        <p role="status">
          <Badge tone="red">{l('Unreachable', 'Injoignable')}</Badge> {report.error} ·{' '}
          <code>{report.url}</code>.{' '}
          {l(
            'Set OLLAMA_URL for the API and the worker.',
            'Définissez OLLAMA_URL pour l’API et le worker.',
          )}
        </p>
      )}
      {report?.reachable && (
        <>
          <p role="status">
            <Badge tone="green">
              <CheckCircle2 size={12} aria-hidden /> {l('Connected', 'Connecté')}
            </Badge>{' '}
            Ollama {report.version} · <code>{report.url}</code> ·{' '}
            {l('requested context window', 'fenêtre de contexte demandée')}{' '}
            {report.numCtx.toLocaleString()} {l('tokens', 'jetons')}
          </p>
          {(missing(l('Chat model', 'Le modèle de conversation'), report.chatModel) ||
            missing(l('Embedding model', 'Le modèle de vecteurs'), report.embeddingModel)) && (
            <ul className="plain-list warning-list">
              {missing(l('Chat model', 'Le modèle de conversation'), report.chatModel)}
              {missing(l('Embedding model', 'Le modèle de vecteurs'), report.embeddingModel)}
            </ul>
          )}
          {report.models.length ? (
            <div className="table-scroll" tabIndex={0} role="region" aria-label={l('Installed models', 'Modèles installés')}>
              <table className="data-table">
                <caption className="sr-only">{l('Installed models', 'Modèles installés')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{l('Model', 'Modèle')}</th>
                    <th scope="col">{l('Size', 'Taille')}</th>
                    <th scope="col">{l('Parameters', 'Paramètres')}</th>
                    <th scope="col">{l('Context', 'Contexte')}</th>
                    <th scope="col">{l('Use', 'Usage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.models.map((m) => (
                    <tr key={m.name}>
                      <th scope="row">
                        <code>{m.name}</code>{' '}
                        {m.loaded && <Badge tone="blue">{l('loaded', 'chargé')}</Badge>}
                      </th>
                      <td>{gigabytes(m.size)}</td>
                      <td>{m.parameterSize ?? '—'}</td>
                      <td>
                        {m.contextLength ? m.contextLength.toLocaleString() : '—'}
                        {m.contextLength && m.contextLength < report.numCtx && (
                          <span className="muted small">
                            {' '}
                            ({l('caps the window', 'limite la fenêtre')})
                          </span>
                        )}
                      </td>
                      <td>
                        {m.capabilities.includes('embedding')
                          ? l('Embeddings', 'Vecteurs')
                          : m.capabilities.includes('completion')
                            ? l('Proposals', 'Propositions')
                            : m.capabilities.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              {l(
                'No models installed yet. Pull one, for example ollama pull qwen2.5:7b.',
                'Aucun modèle installé. Téléchargez-en un, par exemple ollama pull qwen2.5:7b.',
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
