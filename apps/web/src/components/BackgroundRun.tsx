import { useState } from 'react';
import { Play } from 'lucide-react';
import { api } from '../api';
import { useFeatures } from '../features';
import { useL } from '../i18n';
import type { ProjectState } from '../state';
import { ProviderPicker, type ProviderChoice } from './ProviderPicker';
import { Button } from './ui';

/** Advanced durable/isolated-agent runs remain available outside the interactive conversation. */
export function BackgroundRun({ project, onQueued }: { project: ProjectState; onQueued: () => void }) {
  const l = useL();
  const agentRunner = useFeatures().on('agentRunner');
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ProviderChoice | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary>{l('Background run', 'Exécution différée')}</summary>
    {open && <form className="form-stack" onSubmit={async (e) => {
      e.preventDefault();
      if (!choice || busy) return;
      const data = new FormData(e.currentTarget);
      setBusy(true); setError('');
      try {
        await api(`/projects/${project.spec!.id}/jobs`, 'POST', { ...choice, prompt: data.get('prompt'), includeRepository: choice.provider === 'claude-agent' && data.get('repo') === 'on' });
        onQueued(); setOpen(false);
      } catch (err) { setError((err as Error).message); }
      finally { setBusy(false); }
    }}>
      <ProviderPicker localOnly={project.spec!.localOnly} exclude={agentRunner ? [] : ['claude-agent']} onChange={setChoice} />
      <label>{l('Request', 'Demande')}<textarea name="prompt" rows={3} required maxLength={10000} /></label>
      {choice?.provider === 'claude-agent' && <label className="check-label"><input name="repo" type="checkbox" />{l('Read repository snapshot', 'Lire un instantané du dépôt')}</label>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !choice}><Play size={15} aria-hidden />{l('Run', 'Lancer')}</Button>
    </form>}
  </details>;
}
