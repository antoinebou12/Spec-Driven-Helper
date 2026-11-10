import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from './ui';
import { useL, useLang } from '../i18n';
import { emptyUseCase, parseUseCase, reviewUseCase, renderUseCase, type UseCaseFields } from '../../../../packages/shared/src/use-case';

const lines = (text: string) => text.split('\n');

/**
 * Structured use case: actor, trigger, preconditions, main flow, alternate flows and outcome.
 * Writes Markdown into the item body; free text from older items can be kept or converted.
 */
export function UseCaseEditor({ value, onChange }: { value: string; onChange: (markdown: string) => void }) {
  const l = useL();
  const lang = useLang();
  const parsed = parseUseCase(value);
  const [freeText, setFreeText] = useState(!parsed && value.trim().length > 0);
  const [fields, setFields] = useState<UseCaseFields>(parsed ?? emptyUseCase());
  const update = (next: UseCaseFields) => {
    setFields(next);
    onChange(renderUseCase(next, lang));
  };
  if (freeText)
    return (
      <div className="form-stack">
        <label>
          {l('Description', 'Description')}
          <textarea rows={5} value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
        <p className="muted small">
          {l('This use case is free text. Convert it to the structured template to get flow steps and review hints.', 'Ce cas est en texte libre. Convertissez-le au modèle structuré pour obtenir les étapes et des conseils.')}{' '}
          <Button
            size="sm"
            onClick={() => {
              const next = { ...emptyUseCase(), steps: value.split(/\n+/).map((s) => s.replace(/^\s*(\d+\.|[-*])\s*/, '')).filter(Boolean) };
              setFreeText(false);
              update(next);
            }}
          >
            {l('Convert to template', 'Convertir au modèle')}
          </Button>
        </p>
      </div>
    );
  const list = (key: 'preconditions' | 'steps' | 'alternates' | 'postconditions', label: string, placeholder: string, rows = 3) => (
    <label>
      {label}
      <textarea rows={rows} value={fields[key].join('\n')} placeholder={placeholder} onChange={(e) => update({ ...fields, [key]: lines(e.target.value) })} />
      <small className="muted">{l('One per line.', 'Une par ligne.')}</small>
    </label>
  );
  const hints = reviewUseCase(fields, lang);
  return (
    <fieldset className="use-case-editor">
      <legend>{l('Use case', 'Cas d’utilisation')}</legend>
      <div className="form-grid">
        <label>
          {l('Actor', 'Acteur')}
          <input value={fields.actor} maxLength={200} placeholder={l('Customer, support agent, billing service…', 'Client, agent de soutien, service de facturation…')} onChange={(e) => update({ ...fields, actor: e.target.value })} />
        </label>
        <label>
          {l('Trigger', 'Déclencheur')}
          <input value={fields.trigger} maxLength={300} placeholder={l('What starts it', 'Ce qui le déclenche')} onChange={(e) => update({ ...fields, trigger: e.target.value })} />
        </label>
      </div>
      {list('preconditions', l('Preconditions', 'Préconditions'), l('The customer is signed in', 'Le client est connecté'), 2)}
      {list('steps', l('Main flow', 'Scénario principal'), l('The customer opens a new request\nThe system asks for a category\n…', 'Le client ouvre une demande\nLe système demande une catégorie\n…'), 5)}
      {list('alternates', l('Alternate flows and edge cases', 'Variantes et cas limites'), l('Attachment larger than 10 MB: the system explains the limit', 'Pièce jointe de plus de 10 Mo : le système explique la limite'))}
      {list('postconditions', l('Outcome', 'Résultat'), l('The request has an ID and the customer sees its status', 'La demande a un identifiant et le client voit son statut'), 2)}
      {hints.length > 0 && (
        <ul className="use-case-hints" aria-label={l('Suggestions', 'Suggestions')}>
          {hints.map((h) => (
            <li key={h}>
              <Lightbulb size={14} aria-hidden /> {h}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
