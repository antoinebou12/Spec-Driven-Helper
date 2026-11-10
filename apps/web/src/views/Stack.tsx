import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { ArrowRight, GripVertical, Layers3, ListPlus, Plus, Search, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, EmptyState, Switch } from '../components/ui';
import { TechIcon } from '../components/TechIcon';
import { LicenseCheck } from '../components/LicenseCheck';
import { ConventionsGuide } from '../components/ConventionsGuide';
import { layerIcons } from '../icons';
import { licensePolicy } from '../../../../packages/shared/src/licenses';
import { languagesForStack } from '../../../../packages/shared/src/conventions';
import { useL, useLang, useLocalized } from '../i18n';
import { useLocalStorage, type ProjectState } from '../state';
import { can } from '../../../../packages/shared/src/domain';
import { categoryLabels, layerInfo, preferredVersion, slugOf, stackAnswerSuggestions, stackQuestions } from '../../../../packages/shared/src/stack';
import { stackLayers, type StackEntry, type StackLayer, type Technology } from '../../../../packages/shared/src/schema';

const recommended: Record<string, StackLayer[]> = {
  'Web application': ['frontend', 'backend', 'data', 'communication', 'contracts', 'infrastructure', 'iac', 'cicd', 'testing', 'observability', 'development'],
  'API / service': ['backend', 'data', 'communication', 'contracts', 'infrastructure', 'iac', 'cicd', 'testing', 'observability', 'development'],
  'Data / AI system': ['backend', 'ai', 'data', 'communication', 'infrastructure', 'iac', 'cicd', 'testing', 'observability', 'development'],
  'Mobile application': ['mobile', 'backend', 'data', 'communication', 'contracts', 'cicd', 'testing', 'development'],
  'Desktop application': ['desktop', 'data', 'communication', 'cicd', 'testing', 'development'],
  'Library / SDK': ['backend', 'contracts', 'cicd', 'testing', 'development'],
  'Embedded / IoT': ['backend', 'communication', 'contracts', 'cicd', 'testing', 'development'],
};
const categories = ['all', 'language', 'framework', 'runtime', 'database', 'search', 'storage', 'messaging', 'contract', 'cloud', 'networking', 'identity', 'os', 'iac', 'ci-cd', 'testing', 'development', 'observability', 'security', 'ai'] as const;

function TechCard({
  tech,
  onAdd,
  editable,
  layers,
}: {
  tech: Technology;
  onAdd: (layer: StackLayer) => void;
  editable: boolean;
  layers: StackLayer[];
}) {
  const l = useL();
  const loc = useLocalized();
  const latest = tech.versions.find((v) => v.latest);
  const lts = tech.versions.find((v) => v.lts);
  return (
    <li
      className="tech-card"
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-sdd-technology', tech.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {editable && <GripVertical size={14} className="grip" aria-hidden />}
      <TechIcon technology={tech} size={20} />
      <span className="tech-name">
        <strong>{tech.name}</strong>
        <small className="muted">
          {latest && `${l('latest', 'dernière')} ${latest.version}`}
          {lts && lts !== latest && ` · LTS ${lts.version}`}
        </small>
      </span>
      {editable && (
        <label className="add-to">
          <span className="sr-only">{l(`Add ${tech.name} to a layer`, `Ajouter ${tech.name} à une couche`)}</span>
          <Plus size={14} aria-hidden />
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAdd(e.target.value as StackLayer);
            }}
          >
            <option value="">{l('Add to…', 'Ajouter à…')}</option>
            {layers.map((layer) => (
              <option key={layer} value={layer}>
                {loc(layerInfo[layer].label)}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}

export default function Stack({ project, go, notify }: { project: ProjectState; go: (view: string) => void; notify: (m: string) => void }) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [catalog, setCatalog] = useState<Technology[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('all');
  const [ltsOnly, setLtsOnly] = useLocalStorage(`sdd-lts-${spec.id}`, true);
  const [over, setOver] = useState<StackLayer | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    api<Technology[]>('/catalog').then(setCatalog).catch(() => {});
  }, []);
  const suggestedLayers = recommended[spec.projectType] ?? [...stackLayers];
  const layers = showAll ? [...suggestedLayers, ...stackLayers.filter((x) => !suggestedLayers.includes(x))] : suggestedLayers;
  const palette = useMemo(
    () =>
      catalog.filter(
        (t) =>
          (category === 'all' || t.category === category) &&
          `${t.name} ${t.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [catalog, category, query],
  );
  const setStack = (build: (stack: StackEntry[]) => StackEntry[]) => project.save((s) => ({ stack: build(s.stack) }), l('Stack', 'Pile'));
  const add = (technologyId: string, layer: StackLayer) => {
    const tech = catalog.find((t) => t.id === technologyId);
    if (!tech) return;
    setStack((stack) =>
      stack.some((e) => e.technologyId === technologyId && e.layer === layer)
        ? stack
        : [...stack, { technologyId, layer, version: preferredVersion(tech, ltsOnly), note: '' }],
    );
  };
  const onDrop = (layer: StackLayer) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('application/x-sdd-technology');
    if (id) add(id, layer);
  };
  const suggestions = stackAnswerSuggestions(spec, catalog, lang);
  const suggestedAnswers = (suggestions.sections ?? []).reduce((n, s) => n + Object.keys(s.answers ?? {}).length, 0);
  const newQuestions = stackQuestions(spec, catalog);
  const chosen = [...new Set(spec.stack.map((e) => e.technologyId))].map((id) => catalog.find((t) => t.id === id)).filter((t): t is Technology => !!t);
  const languages = languagesForStack(chosen.map(slugOf));
  return (
    <div className="view-body stack-view">
      <div className="stack-intro card">
        <div>
          <h2>
            <Layers3 size={20} aria-hidden /> {l('Choose your technology stack', 'Choisissez votre pile technologique')}
          </h2>
          <p className="muted">
            {l(
              'Drag technologies from the catalog into each layer — or use “Add to…”. Your stack pre-fills structured answers and adds follow-up questions to the interview. You can change it at any time.',
              'Glissez des technologies du catalogue dans chaque couche — ou utilisez « Ajouter à… ». La pile pré-remplit des réponses structurées et ajoute des questions de suivi à l’entretien. Vous pouvez la modifier à tout moment.',
            )}
          </p>
        </div>
        <div className="stack-intro-actions">
          <Switch
            checked={ltsOnly}
            onChange={setLtsOnly}
            label={l('Prefer LTS versions', 'Privilégier les versions LTS')}
            description={l('New selections use the latest long-term-support release when one exists.', 'Les nouveaux choix utilisent la dernière version à support long terme quand elle existe.')}
          />
          <Button variant="primary" onClick={() => go('specification')}>
            {l('Continue to the interview', 'Continuer vers l’entretien')} <ArrowRight size={15} />
          </Button>
        </div>
      </div>
      <div className="stack-layout">
        <section className="card palette" aria-labelledby="palette-title">
          <h3 id="palette-title">{l('Technology catalog', 'Catalogue technologique')}</h3>
          <label className="search-box">
            <Search size={14} aria-hidden />
            <span className="sr-only">{l('Search the catalog', 'Rechercher dans le catalogue')}</span>
            <input value={query} placeholder={l('React, Django, Kotlin…', 'React, Django, Kotlin…')} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="filter-chips" role="group" aria-label={l('Category', 'Catégorie')}>
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
                {c === 'all' ? l('All', 'Tout') : loc(categoryLabels[c])}
              </button>
            ))}
          </div>
          <ul className="tech-list">
            {palette.map((t) => (
              <TechCard key={t.id} tech={t} editable={editable} layers={[...stackLayers]} onAdd={(layer) => add(t.id, layer)} />
            ))}
          </ul>
          {!palette.length && <p className="muted">{l('No technology matches.', 'Aucune technologie ne correspond.')}</p>}
        </section>
        <section className="layers" aria-label={l('Stack layers', 'Couches de la pile')}>
          {layers.map((layer) => {
            const entries = spec.stack.filter((e) => e.layer === layer);
            const LayerIcon = layerIcons[layer];
            return (
              <div
                key={layer}
                className={`layer card ${over === layer ? 'drop-target' : ''}`}
                onDragOver={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  setOver(layer);
                }}
                onDragLeave={() => setOver((o) => (o === layer ? null : o))}
                onDrop={onDrop(layer)}
                aria-labelledby={`layer-${layer}`}
                role="group"
              >
                <header>
                  <h3 id={`layer-${layer}`}>
                    <LayerIcon size={17} aria-hidden /> {loc(layerInfo[layer].label)}
                  </h3>
                  {suggestedLayers.includes(layer) && <Badge tone="blue">{l('Recommended', 'Recommandée')}</Badge>}
                </header>
                <p className="muted small">{loc(layerInfo[layer].hint)}</p>
                {entries.length ? (
                  <ul className="layer-entries">
                    {entries.map((entry) => {
                      const tech = catalog.find((t) => t.id === entry.technologyId);
                      if (!tech) return null;
                      return (
                        <li key={entry.technologyId}>
                          <TechIcon technology={tech} />
                          <strong>{tech.name}</strong>
                          <label>
                            <span className="sr-only">{l(`${tech.name} version`, `Version de ${tech.name}`)}</span>
                            <select
                              value={entry.version}
                              disabled={!editable}
                              onChange={(e) =>
                                setStack((stack) => stack.map((x) => (x === entry || (x.technologyId === entry.technologyId && x.layer === layer) ? { ...x, version: e.target.value } : x)))
                              }
                            >
                              {tech.versions.map((v) => (
                                <option key={v.version} value={v.version}>
                                  {v.version}
                                  {v.lts ? ' · LTS' : ''}
                                  {v.latest ? ` · ${l('latest', 'dernière')}` : ''}
                                  {v.support ? ` — ${v.support}` : ''}
                                </option>
                              ))}
                              {!tech.versions.some((v) => v.version === entry.version) && <option value={entry.version}>{entry.version || '—'}</option>}
                            </select>
                          </label>
                          {editable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={l(`Remove ${tech.name}`, `Retirer ${tech.name}`)}
                              onClick={() => setStack((stack) => stack.filter((x) => !(x.technologyId === entry.technologyId && x.layer === layer)))}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="drop-hint">{editable ? l('Drop technologies here', 'Déposez des technologies ici') : l('Nothing chosen', 'Aucun choix')}</p>
                )}
              </div>
            );
          })}
          <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? l('Show recommended layers only', 'Afficher seulement les couches recommandées') : l('Show all layers', 'Afficher toutes les couches')}
          </Button>
        </section>
      </div>
      {spec.stack.length > 0 && editable && (
        <section className="card stack-suggestions" aria-labelledby="stack-suggestions-title">
          <h3 id="stack-suggestions-title">
            <Sparkles size={17} aria-hidden /> {l('What your stack can fill in', 'Ce que votre pile peut remplir')}
          </h3>
          <div className="inline-actions">
            <Button
              disabled={!suggestedAnswers}
              onClick={async () => {
                if (await project.save(stackAnswerSuggestions(project.spec!, catalog, lang), l('Stack answers', 'Réponses de la pile')))
                  notify(l(`${suggestedAnswers} answers filled from your stack. Review them in the interview.`, `${suggestedAnswers} réponses remplies depuis votre pile. Vérifiez-les dans l’entretien.`));
              }}
            >
              <WandSparkles size={15} />{' '}
              {suggestedAnswers
                ? l(`Fill ${suggestedAnswers} empty answers`, `Remplir ${suggestedAnswers} réponses vides`)
                : l('Stack answers are already filled', 'Les réponses de la pile sont déjà remplies')}
            </Button>
            <Button
              disabled={!newQuestions.length}
              onClick={async () => {
                if (await project.save({ customQuestions: newQuestions }, l('Stack questions', 'Questions de la pile')))
                  notify(l(`${newQuestions.length} follow-up questions added to the interview.`, `${newQuestions.length} questions de suivi ajoutées à l’entretien.`));
              }}
            >
              <ListPlus size={15} />{' '}
              {newQuestions.length
                ? l(`Add ${newQuestions.length} stack-specific questions`, `Ajouter ${newQuestions.length} questions propres à la pile`)
                : l('No new stack questions', 'Aucune nouvelle question')}
            </Button>
          </div>
          {newQuestions.length > 0 && (
            <ul className="small muted">
              {newQuestions.map((q) => (
                <li key={q.id}>{loc(q.prompt)}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      {chosen.length > 0 && <LicenseCheck technologies={chosen} policy={licensePolicy(spec)} />}
      {languages.length > 0 && <ConventionsGuide languages={languages} />}
      {!catalog.length && <EmptyState title={l('The catalog is loading or empty', 'Le catalogue se charge ou est vide')} />}
    </div>
  );
}
