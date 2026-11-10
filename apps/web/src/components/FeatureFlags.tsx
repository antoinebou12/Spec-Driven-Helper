import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, ToggleRight } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, Switch } from './ui';
import { formatDate, useL, useLang } from '../i18n';
import { useFeatures } from '../features';
import { featureIcons } from '../icons';
import { useLatest } from '../hooks';
import {
  featureEffect,
  type FeatureCategory,
  type FeatureId,
  type FeatureState,
} from '../../../../packages/shared/src/feature-flags';

export type FeatureCatalogEntry = {
  id: FeatureId;
  category: FeatureCategory;
  label: { en: string; fr: string };
  description: { en: string; fr: string };
  defaultEnabled: boolean;
};

const categoryLabels: Record<FeatureCategory, [string, string]> = {
  authoring: ['Authoring', 'Rédaction'],
  ai: ['AI and agents', 'IA et agents'],
  delivery: ['Delivery', 'Livraison'],
  integrations: ['Integrations', 'Intégrations'],
  identity: ['Sign-in', 'Connexion'],
  experience: ['Experience', 'Expérience'],
};

/**
 * Workspace feature switches grouped by category. Changes are kept as a draft until saved, so an
 * administrator can review several switches and save them in one audited change.
 */
export function FeatureFlagsPanel({
  catalog,
  value,
  onSave,
  updatedAt,
}: {
  catalog: FeatureCatalogEntry[];
  value: FeatureState;
  onSave: (changes: Partial<FeatureState>) => Promise<void>;
  updatedAt?: string | null;
}) {
  const l = useL();
  const lang = useLang();
  const [draft, setDraft] = useState<FeatureState>(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const changes = useMemo(
    () =>
      Object.fromEntries(
        catalog.filter((f) => draft[f.id] !== value[f.id]).map((f) => [f.id, draft[f.id]]),
      ) as Partial<FeatureState>,
    [catalog, draft, value],
  );
  const changed = Object.keys(changes).length;
  const enabled = catalog.filter((f) => draft[f.id]).length;
  const categories = [...new Set(catalog.map((f) => f.category))];
  return (
    <section className="card form-stack feature-flags" aria-labelledby="feature-flags-title">
      <header className="feature-flags-header">
        <h3 id="feature-flags-title">
          <ToggleRight size={18} aria-hidden /> {l('Features', 'Fonctionnalités')}
        </h3>
        <Badge tone={enabled === catalog.length ? 'green' : 'amber'}>
          {l(`${enabled} of ${catalog.length} on`, `${enabled} sur ${catalog.length} actives`)}
        </Badge>
      </header>
      <p className="muted">
        {l(
          'Switch optional features on or off for the whole workspace. A disabled feature disappears from the interface and its API routes refuse requests. Specification, review, readiness and settings always stay on.',
          'Activez ou désactivez les fonctionnalités facultatives pour tout l’espace. Une fonctionnalité désactivée disparaît de l’interface et ses routes API refusent les requêtes. Spécification, révision, préparation et paramètres restent toujours actifs.',
        )}
      </p>
      {categories.map((category) => (
        <fieldset key={category} className="feature-group">
          <legend>{l(...categoryLabels[category])}</legend>
          {catalog
            .filter((f) => f.category === category)
            .map((f) => {
              const Icon = featureIcons[f.id];
              return (
                <div key={f.id} className={`feature-row ${draft[f.id] ? '' : 'off'}`}>
                  <span className="feature-icon" aria-hidden>
                    {Icon && <Icon size={18} />}
                  </span>
                  <Switch
                    checked={draft[f.id]}
                    onChange={(on) => setDraft({ ...draft, [f.id]: on })}
                    label={
                      <>
                        {f.label[lang]}{' '}
                        {featureEffect(f.id) === 'read-write' ? (
                          <Badge tone="amber" title={l('Can change data', 'Peut modifier des données')}>{l('Read-write', 'Lecture-écriture')}</Badge>
                        ) : (
                          <Badge title={l('Only reads or renders', 'Lit ou affiche seulement')}>{l('Read-only', 'Lecture seule')}</Badge>
                        )}
                        {draft[f.id] !== value[f.id] && (
                          <span className="feature-pending">{l('unsaved', 'non enregistré')}</span>
                        )}
                      </>
                    }
                    description={f.description[lang]}
                  />
                </div>
              );
            })}
        </fieldset>
      ))}
      <div className="inline-actions">
        <Button
          variant="primary"
          disabled={!changed || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(changes);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Save size={15} />{' '}
          {changed
            ? l(
                `Save ${changed} change${changed > 1 ? 's' : ''}`,
                `Enregistrer ${changed} changement${changed > 1 ? 's' : ''}`,
              )
            : l('No changes', 'Aucun changement')}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            setDraft(
              Object.fromEntries(catalog.map((f) => [f.id, f.defaultEnabled])) as FeatureState,
            )
          }
        >
          <RotateCcw size={15} /> {l('Restore defaults', 'Rétablir les valeurs par défaut')}
        </Button>
        {updatedAt && (
          <span className="muted small">
            {l('Last changed', 'Dernier changement')} {formatDate(updatedAt, lang)}
          </span>
        )}
      </div>
    </section>
  );
}

/** Loads and saves the workspace flags, and refreshes the rest of the interface after a save. */
export default function FeatureFlagsAdmin({ notify }: { notify: (message: string) => void }) {
  const l = useL();
  const features = useFeatures();
  const [data, setData] = useState<{
    features: FeatureState;
    catalog: FeatureCatalogEntry[];
    updatedAt: string | null;
  } | null>(null);
  const notifyLatest = useLatest(notify);
  useEffect(() => {
    api('/admin/features')
      .then(setData)
      .catch((e) => notifyLatest.current(e.message));
  }, [notifyLatest]);
  if (!data) return null;
  return (
    <FeatureFlagsPanel
      catalog={data.catalog}
      value={data.features}
      updatedAt={data.updatedAt}
      onSave={async (changes) => {
        try {
          const saved = await api<{ features: FeatureState; catalog: FeatureCatalogEntry[] }>(
            '/admin/features',
            'PUT',
            { features: changes },
          );
          setData({ ...saved, updatedAt: new Date().toISOString() });
          features.replace(saved.features);
          notify(l('Features updated.', 'Fonctionnalités mises à jour.'));
        } catch (e) {
          notify((e as Error).message);
        }
      }}
    />
  );
}
