import { CheckCircle2, CircleDashed, CircleDot, MinusCircle, ShieldCheck } from 'lucide-react';
import { Badge } from './ui';
import { ProgressBar } from './Progress';
import { useL, useLang } from '../i18n';
import { findQuestion } from '../../../../packages/shared/src/templates';
import { securityChecklist, type ChecklistStatus } from '../../../../packages/shared/src/security-checklist';
import type { Spec } from '../../../../packages/shared/src/schema';

const icon: Record<ChecklistStatus, typeof CheckCircle2> = { met: CheckCircle2, partial: CircleDot, missing: CircleDashed, 'not-applicable': MinusCircle };
const tone: Record<ChecklistStatus, string> = { met: 'green', partial: 'amber', missing: 'red', 'not-applicable': 'neutral' };

/** Design coverage of OWASP ASVS and NIST SSDF areas, with a way to answer what is missing. */
export function SecurityChecklist({ spec, onOpenQuestion }: { spec: Spec; onOpenQuestion?: (questionId: string) => void }) {
  const l = useL();
  const lang = useLang();
  const { items, score, met, applicable } = securityChecklist(spec);
  const statusLabel: Record<ChecklistStatus, string> = {
    met: l('Covered', 'Couvert'),
    partial: l('Partly covered', 'Partiel'),
    missing: l('Missing', 'Manquant'),
    'not-applicable': l('Not applicable', 'Sans objet'),
  };
  return (
    <section className="card security-checklist" aria-labelledby="security-checklist-title">
      <h3 id="security-checklist-title">
        <ShieldCheck size={18} aria-hidden /> {l('Security completeness checklist', 'Liste de contrôle de sécurité')}
      </h3>
      <p className="muted small">
        {l(
          `${met} of ${applicable} applicable areas covered. Based on OWASP ASVS and NIST SSDF; it shows what the design answers, not whether the code implements it.`,
          `${met} domaines sur ${applicable} couverts. Basée sur OWASP ASVS et NIST SSDF ; elle montre ce que la conception couvre, pas l’implémentation.`,
        )}
      </p>
      <ProgressBar value={score} label={l('Security coverage', 'Couverture de sécurité')} />
      <ul className="checklist">
        {items.map((item) => {
          const Icon = icon[item.status];
          return (
            <li key={item.id} className={`checklist-item ${item.status}`}>
              <Icon size={16} aria-hidden className={`tone-${tone[item.status]}`} />
              <div>
                <strong>{item.title[lang]}</strong> <small className="muted">{item.reference}</small>
                {item.open.length > 0 && onOpenQuestion && (
                  <div className="inline-actions">
                    {item.open.map((id) => (
                      <button key={id} type="button" className="link-button" onClick={() => onOpenQuestion(id)}>
                        {l('Answer', 'Répondre')}: {findQuestion(id)?.label[lang] ?? id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Badge tone={tone[item.status]}>{statusLabel[item.status]}</Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
