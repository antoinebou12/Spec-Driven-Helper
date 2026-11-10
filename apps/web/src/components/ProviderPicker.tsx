import { useEffect, useState } from 'react';
import { useLatest } from '../hooks';
import { api } from '../api';
import { useL } from '../i18n';

type Provider = { id: string; label: string; model: string; configured: boolean };
export type ProviderChoice = { provider: string; model: string };

/**
 * Configured providers and the models each can use right now. Local-only projects only see
 * Ollama; nothing falls back to a cloud provider.
 */
export function ProviderPicker({ localOnly, exclude = [], onChange }: { localOnly: boolean; exclude?: string[]; onChange: (choice: ProviderChoice | null) => void }) {
  const l = useL();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [error, setError] = useState('');
  const excluded = exclude.join();
  useEffect(() => {
    api<Provider[]>('/integrations').then((list) => {
      const skip = excluded.split(',');
      const usable = list.filter((p) => p.configured && (!localOnly || p.id === 'ollama') && !skip.includes(p.id));
      setProviders(usable);
      setProvider(usable[0]?.id ?? '');
    });
  }, [localOnly, excluded]);
  const latestProviders = useLatest(providers);
  useEffect(() => {
    if (!provider) return;
    setModels([]);
    setError('');
    api<{ models: string[] }>(`/integrations/${provider}/models`)
      .then(({ models: list }) => {
        setModels(list);
        const preferred = latestProviders.current.find((p) => p.id === provider)?.model;
        setModel(preferred && list.includes(preferred) ? preferred : (list[0] ?? ''));
      })
      .catch((e) => setError(e.message));
  }, [provider, latestProviders]);
  const latestOnChange = useLatest(onChange);
  useEffect(() => {
    latestOnChange.current(provider && model ? { provider, model } : null);
  }, [provider, model, latestOnChange]);
  if (!providers.length)
    return (
      <p className="notice warning">
        {localOnly
          ? l('This project is local-only. Configure Ollama to use AI assistance.', 'Ce projet est local uniquement. Configurez Ollama pour utiliser l’IA.')
          : l('No AI provider is configured. An administrator can add one in Settings.', 'Aucun fournisseur IA n’est configuré. Un administrateur peut en ajouter dans les paramètres.')}
      </p>
    );
  return (
    <div className="form-grid">
      <label>
        {l('Provider', 'Fournisseur')}
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {l('Model', 'Modèle')}
        <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length}>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {error && <p className="error-text span-two">{error}</p>}
    </div>
  );
}
