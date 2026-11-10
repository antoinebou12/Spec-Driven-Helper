import { ArrowRight, CheckCircle2, Circle, CircleDot, Workflow } from 'lucide-react';
import { Badge, Button } from './ui';
import { useL, useLocalized } from '../i18n';
import { useFeatures } from '../features';
import { phaseStatuses, sddPhases, type PhaseStatus } from '../../../../packages/shared/src/spec-kit';
import type { Spec } from '../../../../packages/shared/src/schema';

type Go = (view: string, target?: { sectionId?: string; questionId?: string }) => void;
const statusIcon: Record<PhaseStatus, typeof Circle> = { done: CheckCircle2, active: CircleDot, todo: Circle };

/** Spec-driven workflow (after GitHub Spec Kit): each phase, its status and the view that does it. */
export function SddWorkflow({ spec, go }: { spec: Spec; go: Go }) {
  const l = useL();
  const loc = useLocalized();
  const { hidden } = useFeatures();
  const status = phaseStatuses(spec);
  const persistence = spec.sections.find((s) => s.id === 'governance')?.answers['governance.12'];
  const label: Record<PhaseStatus, string> = { done: l('Done', 'Fait'), active: l('Current', 'En cours'), todo: l('To do', 'À faire') };
  return (
    <section className="card span-two sdd-workflow" aria-labelledby="sdd-workflow-title">
      <h3 id="sdd-workflow-title">
        <Workflow size={18} aria-hidden /> {l('Spec-driven workflow', 'Flux piloté par la spécification')}
      </h3>
      <p className="muted small">
        {l(
          'The specification leads, code follows. Work through the phases in order; each one opens the view that does it.',
          'La spécification mène, le code suit. Suivez les phases dans l’ordre ; chacune ouvre la vue correspondante.',
        )}
      </p>
      <ol className="sdd-phases">
        {sddPhases.map((p, i) => {
          const Icon = statusIcon[status[p.id]];
          const unavailable = hidden.has(p.view);
          return (
            <li key={p.id} className={`sdd-phase ${status[p.id]}`} aria-current={status[p.id] === 'active' ? 'step' : undefined}>
              <div className="sdd-phase-head">
                <Icon size={16} aria-hidden />
                <span className="sdd-phase-number">{i + 1}</span>
                <strong>{loc(p.title)}</strong>
                <Badge tone={status[p.id] === 'done' ? 'green' : status[p.id] === 'active' ? 'blue' : 'neutral'}>{label[status[p.id]]}</Badge>
              </div>
              <code className="small">{p.command}</code>
              <p className="small muted">{loc(p.summary)}</p>
              <Button
                variant="ghost"
                size="sm"
                disabled={unavailable}
                title={unavailable ? l('Turned off by an administrator', 'Désactivé par un administrateur') : undefined}
                onClick={() => (p.view === 'specification' ? go('specification', { sectionId: p.modules[0] }) : go(p.view))}
              >
                {l('Open', 'Ouvrir')} <span className="sr-only">{loc(p.title)}</span> <ArrowRight size={14} aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>
      <p className="small">
        <strong>{l('Persistence model:', 'Modèle de persistance :')}</strong>{' '}
        {persistence?.state === 'answered' && persistence.value ? (
          persistence.value
        ) : (
          <Button variant="ghost" size="sm" onClick={() => go('specification', { sectionId: 'governance', questionId: 'governance.12' })}>
            {l('Choose flow-forward, flow-back or living specification', 'Choisir flux avant, flux retour ou spécification vivante')}
          </Button>
        )}
      </p>
    </section>
  );
}
