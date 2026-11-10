import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Scale } from 'lucide-react';
import { Badge } from './ui';
import { TechIcon } from './TechIcon';
import { useL, useLocalized } from '../i18n';
import {
  familyLabels,
  licenseFamily,
  licenseFindings,
  type LicenseFinding,
  type LicensePolicy,
} from '../../../../packages/shared/src/licenses';
import type { Technology } from '../../../../packages/shared/src/schema';

const severityIcon = { blocker: AlertOctagon, warning: AlertTriangle, info: Info } as const;
const severityTone = { blocker: 'red', warning: 'amber', info: 'neutral' } as const;
const familyTone: Record<string, string> = {
  permissive: 'green',
  standard: 'green',
  'weak-copyleft': 'blue',
  commercial: 'violet',
  'strong-copyleft': 'amber',
  'network-copyleft': 'amber',
  'source-available': 'amber',
  unknown: 'neutral',
};

/**
 * License rules for the chosen stack, checked against the project license, distribution model and
 * dependency allow-list recorded in the governance section. Guidance only, not legal advice.
 */
export function LicenseCheck({
  technologies,
  policy,
}: {
  technologies: Technology[];
  policy: LicensePolicy;
}) {
  const l = useL();
  const loc = useLocalized();
  const findings = licenseFindings(technologies, policy);
  const count = (s: LicenseFinding['severity']) => findings.filter((f) => f.severity === s).length;
  const described = policy.projectLicense || policy.distribution;
  return (
    <section className="card license-check" aria-labelledby="license-check-title">
      <header className="license-check-header">
        <h3 id="license-check-title">
          <Scale size={18} aria-hidden /> {l('License check', 'Vérification des licences')}
        </h3>
        <span className="inline-actions">
          {count('blocker') > 0 && (
            <Badge tone="red">
              {l(`${count('blocker')} blocking`, `${count('blocker')} bloquant(s)`)}
            </Badge>
          )}
          {count('warning') > 0 && (
            <Badge tone="amber">
              {l(`${count('warning')} to review`, `${count('warning')} à réviser`)}
            </Badge>
          )}
          {!count('blocker') && !count('warning') && (
            <Badge tone="green">{l('No conflicts found', 'Aucun conflit trouvé')}</Badge>
          )}
        </span>
      </header>
      <p className="muted small">
        {described
          ? l(
              `Checked against: ${policy.projectLicense || 'license not set'} · ${policy.distribution || 'distribution not set'}${policy.allowed.length ? ` · allowed: ${policy.allowed.map((f) => familyLabels[f].en.toLowerCase()).join(', ')}` : ''}.`,
              `Vérifiée selon : ${policy.projectLicense || 'licence non définie'} · ${policy.distribution || 'distribution non définie'}${policy.allowed.length ? ` · permises : ${policy.allowed.map((f) => familyLabels[f].fr.toLowerCase()).join(', ')}` : ''}.`,
            )
          : l(
              'Answer the project license, distribution model and allowed dependency licenses in the Governance section to check the stack against your policy.',
              'Répondez à la licence du projet, au mode de distribution et aux licences permises dans la section Gouvernance pour vérifier la pile selon votre politique.',
            )}{' '}
        {l(
          'Guidance only — confirm with your legal team.',
          'À titre indicatif — confirmez avec votre équipe juridique.',
        )}
      </p>
      <ul className="license-list">
        {technologies.map((t) => {
          const family = licenseFamily(t.license);
          return (
            <li key={t.id}>
              <TechIcon technology={t} size={16} />
              <span className="license-name">{t.name}</span>
              <code>{t.license || '—'}</code>
              <Badge tone={familyTone[family]}>{loc(familyLabels[family])}</Badge>
            </li>
          );
        })}
      </ul>
      {findings.length > 0 ? (
        <ul className="license-findings">
          {findings.map((f, i) => {
            const Icon = severityIcon[f.severity];
            return (
              <li
                key={`${f.technologyId}-${f.rule}-${i}`}
                className={`license-finding ${f.severity}`}
              >
                <Icon size={16} aria-hidden />
                <span>
                  <Badge tone={severityTone[f.severity]}>
                    {f.severity === 'blocker'
                      ? l('Blocking', 'Bloquant')
                      : f.severity === 'warning'
                        ? l('Review', 'À réviser')
                        : l('Note', 'Note')}
                  </Badge>{' '}
                  {loc(f.message)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">
          <CheckCircle2 size={14} aria-hidden />{' '}
          {l(
            'Every license in the stack fits the recorded policy.',
            'Chaque licence de la pile respecte la politique consignée.',
          )}
        </p>
      )}
    </section>
  );
}
