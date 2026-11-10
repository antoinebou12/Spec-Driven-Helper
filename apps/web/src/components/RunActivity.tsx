import { useCallback, useEffect, useState } from 'react';
import { useLatest } from '../hooks';
import { CircleStop, Loader2 } from 'lucide-react';
import { api } from '../api';
import { Badge, Button } from './ui';
import { formatDate, useL, useLang } from '../i18n';

type RunEvent = { type: string; index: number; stepName?: string; toolCallName?: string; message?: string; timestamp?: number };
type Job = {
  id: string;
  provider: string;
  model: string;
  kind?: string;
  status: string;
  createdAt: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
  context?: { mode: 'full' | 'compact'; window?: number; focus?: string[]; echoesDropped?: number; unknownDropped?: number; downgradesDropped?: number };
  events: RunEvent[];
  proposalId?: string;
};
const active = (j: Job) => j.status === 'queued' || j.status === 'running';
const tone: Record<string, string> = { completed: 'green', failed: 'red', canceled: 'neutral', running: 'blue', queued: 'blue' };

/** AI runs and their AG-UI event streams, updated live while a run is active. */
export function RunActivity({ projectId, canCancel, onFinished }: { projectId: string; canCancel: boolean; onFinished: () => void }) {
  const l = useL();
  const lang = useLang();
  const [jobs, setJobs] = useState<Job[]>([]);
  const reload = useCallback(() => api<Job[]>(`/projects/${projectId}/jobs`).then(setJobs), [projectId]);
  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);
  const runningId = jobs.find(active)?.id;
  const finished = useLatest(onFinished);
  useEffect(() => {
    if (!runningId) return;
    const stream = new EventSource(`/api/v1/projects/${projectId}/jobs/${runningId}/events`);
    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as RunEvent;
      setJobs((all) =>
        all.map((j) =>
          j.id === runningId && !j.events.some((e) => e.index === event.index)
            ? { ...j, status: j.status === 'queued' ? 'running' : j.status, events: [...j.events, event] }
            : j,
        ),
      );
      if (event.type === 'RUN_FINISHED' || event.type === 'RUN_ERROR') {
        stream.close();
        reload().then(() => finished.current(), () => {});
      }
    };
    stream.onerror = () => {
      stream.close();
      setTimeout(() => reload().catch(() => {}), 3000);
    };
    return () => stream.close();
  }, [runningId, projectId, reload, finished]);
  const describe = (e: RunEvent) =>
    ({
      RUN_STARTED: l('Run started', 'Exécution démarrée'),
      RUN_FINISHED: l('Proposal ready for review', 'Proposition prête pour révision'),
      RUN_ERROR: `${l('Error', 'Erreur')}: ${e.message}`,
      STEP_STARTED: `${l('Step', 'Étape')}: ${e.stepName}`,
      STEP_FINISHED: `✓ ${e.stepName}`,
      TOOL_CALL_START: `${l('Agent tool', 'Outil de l’agent')}: ${e.toolCallName}`,
      STATE_SNAPSHOT: l('Generated follow-up controls', 'Contrôles de suivi générés'),
      CUSTOM: l('Context shortened to fit the local model', 'Contexte raccourci pour le modèle local'),
    })[e.type] ?? e.type;
  if (!jobs.length) return <p className="muted">{l('No AI runs yet.', 'Aucune exécution IA pour l’instant.')}</p>;
  return (
    <ul className="run-list" aria-live="polite">
      {jobs.slice(0, 8).map((j) => (
        <li key={j.id} className="run">
          <div className="run-heading">
            {active(j) && <Loader2 size={14} className="spin" aria-hidden />}
            <strong>{j.kind === 'pdf' || j.kind === 'image' ? j.kind.toUpperCase() : j.provider === 'claude-agent' ? 'Claude Agent' : j.provider}</strong>
            <span className="muted">{j.model}</span>
            <Badge tone={tone[j.status]}>
              {{ queued: l('queued', 'en attente'), running: l('running', 'en cours'), completed: l('completed', 'terminée'), failed: l('failed', 'échouée'), canceled: l('canceled', 'annulée') }[j.status] ?? j.status}
            </Badge>
            <span className="muted small">{formatDate(j.createdAt, lang)}</span>
            {canCancel && active(j) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => api(`/projects/${projectId}/jobs/${j.id}/cancel`, 'POST').then(reload)}
              >
                <CircleStop size={14} /> {l('Cancel', 'Annuler')}
              </Button>
            )}
          </div>
          {j.error && <p className="error-text small">{j.error}</p>}
          {j.usage && (
            <p className="muted small">
              {l('Tokens', 'Jetons')}: {j.usage.inputTokens} + {j.usage.outputTokens}
              {j.context?.window && ` · ${l('context window', 'fenêtre de contexte')} ${j.context.window}`}
            </p>
          )}
          {j.context?.mode === 'compact' && (
            <p className="muted small">
              {l('Compact context for a local model, focused on', 'Contexte compact pour un modèle local, centré sur')} {j.context.focus?.join(', ') || '—'}
            </p>
          )}
          {!!j.context?.echoesDropped && (
            <p className="muted small">
              {l(`${j.context.echoesDropped} unchanged answers returned by the model were left out`, `${j.context.echoesDropped} réponses renvoyées sans changement par le modèle ont été écartées`)}
            </p>
          )}
          {!!j.context?.downgradesDropped && (
            <p className="muted small">
              {l(`${j.context.downgradesDropped} recorded answers the model marked as unknown were kept; see its assumptions`, `${j.context.downgradesDropped} réponses consignées que le modèle marquait inconnues ont été conservées ; voir ses hypothèses`)}
            </p>
          )}
          {!!j.context?.unknownDropped && (
            <p className="muted small">
              {l(`${j.context.unknownDropped} answers to questions that do not exist were left out`, `${j.context.unknownDropped} réponses à des questions inexistantes ont été écartées`)}
            </p>
          )}
          {j.events.length > 0 && (
            <details open={active(j)}>
              <summary>{l(`${j.events.length} events`, `${j.events.length} événements`)}</summary>
              <ol className="event-list">
                {j.events
                  .filter((e) => e.type !== 'STEP_FINISHED' && e.type !== 'TOOL_CALL_END')
                  .map((e) => (
                    <li key={e.index}>{describe(e)}</li>
                  ))}
              </ol>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
