import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button } from '../components/ui';
import FeatureFlagsAdmin from '../components/FeatureFlags';
import ObservabilityPanel from '../components/ObservabilityPanel';
import ExampleData from '../components/ExampleData';
import { OllamaStatus } from '../components/OllamaStatus';
import { useL } from '../i18n';

export default function Admin() {
  const l = useL();
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([api('/admin/configuration'), api('/admin/stats')]).then(([c,s]) => {setConfig(c);setStats(s);}).catch(e=>setMessage(e.message)); }, []);
  const field = (key: string, label: string, secret = false) => <label key={key}>{label}<input type={secret?'password':'text'} autoComplete={secret?'new-password':'off'} value={config[key]??''} placeholder={secret && config[`${key}Configured`]?l('Configured · leave blank to keep','Configuré · laisser vide pour conserver'):''} onChange={e=>setConfig({...config,[key]:e.target.value})}/></label>;
  return <div className="form-stack">
    <header><h2>{l('Administration','Administration')}</h2><p className="muted">{l('Identity, integrations and live operating data. Changes are audited.','Identité, intégrations et données opérationnelles. Les changements sont audités.')}</p></header>
    {message && <p role="status">{message}</p>}
    {stats && <><div className="admin-metrics">{[['Projects','Projets',stats.projects],['Users','Utilisateurs',stats.users],['Revisions','Révisions',stats.revisions],['Pending proposals','Propositions en attente',stats.pending]].map(([en,fr,value])=><article className="card" key={en}><small>{l(String(en),String(fr))}</small><strong>{value}</strong></article>)}</div><p className="muted">{stats.database} · {stats.databaseLatencyMs} ms · {stats.memoryMB} MB · {l('Uptime','Durée de fonctionnement')} {stats.uptimeSeconds}s</p></>}
    {config && <form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('/admin/configuration','PUT',config);setMessage(l('Configuration saved.','Configuration enregistrée.'));setConfig(await api('/admin/configuration'));}catch(err){setMessage((err as Error).message);}finally{setBusy(false);}}}>
      <div className="settings-grid"><fieldset className="card form-stack"><legend>{l('Identity & access','Identité et accès')}</legend>
        <label className="check-label"><input type="checkbox" checked={config.registration} onChange={e=>setConfig({...config,registration:e.target.checked})}/>{l('Allow account requests (administrator activation required)','Autoriser les demandes de compte (activation administrative requise)')}</label>
        {field('googleClientId','Google Client ID')}{field('googleSecret','Google Client secret',true)}
        <small className="muted">Google callback: /api/v1/auth/google/callback</small>
        {field('oidcIssuer','OIDC issuer (HTTPS)')}{field('oidcClientId','OIDC Client ID')}{field('oidcSecret','OIDC Client secret',true)}
        <small className="muted">SSO callback: /api/v1/auth/oidc/callback</small>
      </fieldset><fieldset className="card form-stack"><legend>{l('Diagrams & search','Diagrammes et recherche')}</legend>
        {field('krokiUrl','Kroki endpoint')}{field('umlMcpUrl','antoieobu12/uml-mcp endpoint')}{field('umlMcpSecret','UML MCP token',true)}
        <label>{l('Allowed UML tools (one per line)','Outils UML autorisés (un par ligne)')}<textarea value={config.umlAllowedTools.join('\n')} onChange={e=>setConfig({...config,umlAllowedTools:e.target.value.split('\n').filter(Boolean)})}/></label>
        <label>{l('Embedding provider','Fournisseur de vecteurs')}<select value={config.embeddingProvider} onChange={e=>setConfig({...config,embeddingProvider:e.target.value})}><option value="ollama">Ollama (local)</option><option value="openai">OpenAI</option></select></label>
        {field('embeddingModel',l('Embedding model','Modèle de vecteurs'))}
        <p className="muted">{l('Changing the model requires rebuilding project search indexes. Local-only projects require Ollama.','Changer le modèle nécessite une réindexation. Les projets locaux exigent Ollama.')}</p>
      </fieldset></div><Button variant="primary" type="submit" disabled={busy}>{l('Save configuration','Enregistrer la configuration')}</Button>
    </form>}
    <OllamaStatus />
    <ObservabilityPanel />
    <FeatureFlagsAdmin notify={setMessage} />
    <ExampleData />
    {stats && <section className="card"><h3>{l('Recent security events','Événements de sécurité récents')}</h3><ul>{stats.events.map((e:any)=><li key={e.id}>{e.at} · {e.action}</li>)}</ul></section>}
  </div>;
}
