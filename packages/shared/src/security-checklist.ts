import type { Spec } from './schema';
import type { Language, Localized } from './templates';
import { appliesTo, findQuestion } from './templates';
import { isComplete } from './domain';

/**
 * Security completeness checklist: the areas an application-security review expects a design to
 * cover, following OWASP ASVS chapters and NIST SSDF practices, each tied to the specification
 * questions that answer it. It shows what is covered; it does not certify the implementation.
 */
export type ChecklistStatus = 'met' | 'partial' | 'missing' | 'not-applicable';
type Control = { id: string; title: Localized; reference: string; questions: string[] };

export const securityControls: Control[] = [
  { id: 'threat-model', title: { en: 'Threat model and trust boundaries', fr: 'Modèle de menaces et frontières de confiance' }, reference: 'ASVS V1 · SSDF PW.1', questions: ['security.2'] },
  { id: 'authentication', title: { en: 'Authentication and multi-factor', fr: 'Authentification et multifacteur' }, reference: 'ASVS V6', questions: ['security.3', 'security.12'] },
  { id: 'access-control', title: { en: 'Authorization and roles', fr: 'Autorisation et rôles' }, reference: 'ASVS V8', questions: ['security.4'] },
  { id: 'sessions', title: { en: 'Sessions, cookies and client storage', fr: 'Sessions, témoins et stockage client' }, reference: 'ASVS V7 · V3', questions: ['security.11'] },
  { id: 'validation', title: { en: 'Input validation and error contracts', fr: 'Validation des entrées et contrats d’erreur' }, reference: 'ASVS V2 · V16', questions: ['data.4'] },
  { id: 'classification', title: { en: 'Data classification', fr: 'Classification des données' }, reference: 'ASVS V14', questions: ['security.14', 'security.1'] },
  { id: 'cryptography', title: { en: 'Encryption in transit and at rest', fr: 'Chiffrement en transit et au repos' }, reference: 'ASVS V11 · V12', questions: ['security.6'] },
  { id: 'secrets', title: { en: 'Secrets and key management', fr: 'Secrets et gestion des clés' }, reference: 'ASVS V13 · SSDF PS.1', questions: ['security.5', 'delivery.2'] },
  { id: 'privacy', title: { en: 'Privacy obligations', fr: 'Obligations de confidentialité' }, reference: 'ASVS V14 · GDPR/Law 25', questions: ['security.13', 'security.8'] },
  { id: 'logging', title: { en: 'Audit logging and monitoring', fr: 'Journalisation d’audit et surveillance' }, reference: 'ASVS V16', questions: ['security.7', 'operations.2'] },
  { id: 'supply-chain', title: { en: 'Dependencies and supply chain', fr: 'Dépendances et chaîne d’approvisionnement' }, reference: 'SSDF PW.4 · PS.3', questions: ['governance.10', 'governance.11', 'delivery.19'] },
  { id: 'security-testing', title: { en: 'Security testing', fr: 'Tests de sécurité' }, reference: 'SSDF PW.7 · PW.8', questions: ['testing.5'] },
  { id: 'incident-response', title: { en: 'Incident response', fr: 'Réponse aux incidents' }, reference: 'SSDF RV.1 · RV.2', questions: ['operations.4'] },
  { id: 'recovery', title: { en: 'Backup, restore and disaster recovery', fr: 'Sauvegarde, restauration et reprise' }, reference: 'ASVS V14', questions: ['operations.6', 'operations.7'] },
  { id: 'ai-misuse', title: { en: 'AI misuse and prompt injection', fr: 'Mauvais usage de l’IA et injection de consignes' }, reference: 'OWASP LLM Top 10', questions: ['security.9'] },
];

export type ChecklistItem = Control & { status: ChecklistStatus; answered: string[]; open: string[] };

export function securityChecklist(spec: Spec) {
  const answerOf = (id: string) => spec.sections.find((s) => s.id === id.split('.')[0])?.answers[id];
  const items: ChecklistItem[] = securityControls.map((control) => {
    const applicable = control.questions.filter((id) => {
      const q = findQuestion(id);
      return q && appliesTo(q, spec.projectType) && answerOf(id)?.state !== 'not-applicable';
    });
    const answered = applicable.filter((id) => isComplete(answerOf(id)));
    const status: ChecklistStatus = !applicable.length ? 'not-applicable' : answered.length === applicable.length ? 'met' : answered.length ? 'partial' : 'missing';
    return { ...control, status, answered, open: applicable.filter((id) => !answered.includes(id)) };
  });
  const counted = items.filter((i) => i.status !== 'not-applicable');
  const score = counted.length ? Math.round((counted.reduce((n, i) => n + (i.status === 'met' ? 1 : i.status === 'partial' ? 0.5 : 0), 0) / counted.length) * 100) : 100;
  return { items, score, met: items.filter((i) => i.status === 'met').length, applicable: counted.length };
}

const marks: Record<ChecklistStatus, string> = { met: '[x]', partial: '[/]', missing: '[ ]', 'not-applicable': '[-]' };

/** `.plan/security-checklist.md` for the implementation bundle. */
export function securityChecklistMarkdown(spec: Spec, lang: Language = spec.language) {
  const { items, score } = securityChecklist(spec);
  const t = (en: string, fr: string) => (lang === 'fr' ? fr : en);
  const label = (id: string) => findQuestion(id)?.label[lang] ?? id;
  return `# ${t('Security completeness checklist', 'Liste de contrôle de sécurité')}\n\n${t(
    `Coverage ${score}% — design coverage of OWASP ASVS and NIST SSDF areas, not a certification of the implementation.`,
    `Couverture ${score} % — couverture de conception des domaines OWASP ASVS et NIST SSDF, pas une certification de l’implémentation.`,
  )}\n\n${t('Status', 'Statut')}: \`[x]\` ${t('covered', 'couvert')}, \`[/]\` ${t('partly', 'partiel')}, \`[ ]\` ${t('missing', 'manquant')}, \`[-]\` ${t('not applicable', 'sans objet')}.\n\n${items
    .map((i) => `- ${marks[i.status]} **${i.title[lang]}** (${i.reference})${i.open.length ? ` — ${t('answer', 'répondre à')}: ${i.open.map((id) => `${label(id)} (${id})`).join(', ')}` : ''}`)
    .join('\n')}\n`;
}
