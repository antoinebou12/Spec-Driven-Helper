import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useL } from '../i18n';
import { Button, Modal } from './ui';
import { projectTypeLabels, projectTypes, type Language } from '../../../../packages/shared/src/templates';
import { essentialCount, levelHelp, levelLabels, type SpecLevel } from '../../../../packages/shared/src/essentials';
import { draftNotice, type Draft } from '../draft';

export function NewProject({
  onClose,
  onCreated,
  notify = () => {},
  lang,
}: {
  onClose: () => void;
  onCreated: (id: string, sample: boolean) => void;
  /** Tells the person what became of the draft the AI was asked for. */
  notify?: (message: string) => void;
  lang: Language;
}) {
  const l = useL();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  // The essentials are a few questions different for a library or a device, so the count follows the type.
  const [type, setType] = useState('Web application');
  return (
    <Modal open onOpenChange={onClose} title={l('New project', 'Nouveau projet')}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const field = (key: string) => (f.get(key) as string | null) ?? undefined;
            const idea = (field('description') ?? '').trim();
            const created = await api('/projects', 'POST', {
              name: field('name'),
              description: field('description'),
              projectType: field('projectType'),
              language: field('language') ?? lang,
              localOnly: f.get('localOnly') === 'on',
              example: f.get('example') === 'on',
              level: (field('level') as SpecLevel | undefined) ?? 'essentials',
              sample,
            });
            // One sentence is enough: when there is one, ask the AI (if one is set up) to draft the essential answers.
            if (!sample && idea.length >= 3) {
              try {
                const draft = await api<Draft>(`/projects/${created.id}/draft`, 'POST', { idea });
                notify(draftNotice(draft, l));
              } catch {
                notify(l('The project was created, but the draft could not be requested.', 'Le projet est créé, mais le brouillon n’a pas pu être demandé.'));
              }
            }
            onCreated(created.id, sample);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="check-label">
          <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} />
          {l(
            'Start from the complete example project (Customer Request Portal)',
            'Partir du projet d’exemple complet (portail de demandes clients)',
          )}
        </label>
        <label>
          {l('Project name', 'Nom du projet')}
          <input
            name="name"
            required
            maxLength={120}
            autoFocus
            defaultValue={sample ? 'Customer Request Portal' : ''}
            key={String(sample)}
          />
        </label>
        {!sample && (
          <>
            <label>
              {l('What are you building? (optional)', 'Que construisez-vous ? (facultatif)')}
              <textarea name="description" rows={2} maxLength={3000} aria-describedby="idea-help" />
              <small id="idea-help" className="muted">
                {l(
                  'One sentence is enough. If an AI is set up, it drafts the essential answers for you to review.',
                  'Une phrase suffit. Si une IA est configurée, elle rédige les réponses essentielles que vous réviserez.',
                )}
              </small>
            </label>
            <fieldset className="level-choice">
              <legend>{l('How much to specify', 'Niveau de détail')}</legend>
              {(['essentials', 'complete'] as const).map((level) => (
                <label key={level} className="check-label">
                  <input type="radio" name="level" value={level} defaultChecked={level === 'essentials'} />
                  <span>
                    <strong>{lang === 'fr' ? levelLabels[level].fr : levelLabels[level].en}</strong>
                    {level === 'essentials' ? ` (${l('recommended', 'recommandé')})` : ''} {'— '}
                    {levelHelp(level, lang, type)}
                  </span>
                </label>
              ))}
              <small className="muted">
                {l(
                  `Essentials asks ${essentialCount(type)} core questions. You can switch to Complete in Settings at any time.`,
                  `L’essentiel pose ${essentialCount(type)} questions clés. Vous pouvez passer à Complet dans les paramètres à tout moment.`,
                )}
              </small>
            </fieldset>
            <div className="form-grid">
              <label>
                {l('Project type', 'Type de projet')}
                <select name="projectType" value={type} onChange={(e) => setType(e.target.value)}>
                  {projectTypes.map((t) => (
                    <option key={t} value={t}>
                      {projectTypeLabels[t][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {l('Document language', 'Langue du document')}
                <select name="language" defaultValue={lang}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </label>
            </div>
            <label className="check-label">
              <input type="checkbox" name="example" />
              {l(
                'Include worked examples in each document',
                'Inclure des exemples dans chaque document',
              )}
            </label>
          </>
        )}
        <label className="check-label">
          <input type="checkbox" name="localOnly" />
          {l(
            'Local AI only — never send this project to cloud providers',
            'IA locale uniquement — ne jamais envoyer ce projet à des fournisseurs infonuagiques',
          )}
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {l('Create project', 'Créer le projet')} <ArrowRight size={15} />
        </Button>
      </form>
    </Modal>
  );
}
