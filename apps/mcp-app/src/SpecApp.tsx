import { App, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { specVisualSchema, type SpecVisual } from '../../../packages/shared/src/spec-visualizer';
import { SpecVisualizer } from '../../web/src/components/SpecVisualizer';
import { LanguageProvider } from '../../web/src/i18n';
import './app.css';

const app = new App({ name: 'SDD Studio visualizer', version: '1.0.0' }, {});

function SpecApp() {
  const [data, setData] = useState<SpecVisual>();
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const l = (en: string, fr: string) => (data?.language === 'fr' ? fr : en);
  useEffect(() => {
    const receive = (value: unknown) => {
      const parsed = specVisualSchema.safeParse(value);
      if (parsed.success) {
        setData(parsed.data);
        document.documentElement.lang = parsed.data.language;
        setError('');
      } else setError('Unable to read the specification / Impossible de lire la spécification');
    };
    app.ontoolresult = (result) => receive(result.structuredContent);
    app.onhostcontextchanged = (context) => {
      if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
      if (context.theme) document.documentElement.dataset.theme = context.theme;
    };
    void app
      .connect()
      .then(() => {
        const context = app.getHostContext();
        if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
        if (context?.theme) document.documentElement.dataset.theme = context.theme;
      })
      .catch(() =>
        setError('Open this view in an MCP Apps client / Ouvrez cette vue dans un client MCP Apps'),
      );
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch {
      setError(l('The request failed. Try again.', 'La demande a échoué. Réessayez.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LanguageProvider lang={data?.language ?? 'en'}>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!data && (
        <p role="status">
          {l('Waiting for the specification…', 'En attente de la spécification…')}
        </p>
      )}
      {data && (
        <SpecVisualizer
          data={data}
          busy={busy}
          onPage={(offset) =>
            void run(async () => {
              const result = await app.callServerTool({
                name: 'show_specification',
                arguments: { offset },
              });
              if (result.isError) throw new Error('Tool failed');
              setData(specVisualSchema.parse(result.structuredContent));
              setDetail('');
            })
          }
          onSection={(sectionId) =>
            void run(async () => {
              const result = await app.callServerTool({
                name: 'get_section',
                arguments: { sectionId },
              });
              if (result.isError) throw new Error('Tool failed');
              const section = result.structuredContent as {
                title: string;
                markdown: string;
                truncated: boolean;
              };
              setDetail(
                `${section.title}\n\n${section.markdown}${section.truncated ? l('\nPreview truncated. Read the specification resource for the full document.', '\nAperçu tronqué. Consultez la ressource de spécification pour le document complet.') : ''}`,
              );
            })
          }
          onImprove={(sectionId) =>
            void run(async () => {
              const result = await app.sendMessage({
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Help improve specification section ${sectionId}, based on revision ${data.revision}. Read its current answers with get_section, ask me about missing decisions, then use propose_change with baseRevision and evidence for human review. Do not invent facts or approve changes.`,
                  },
                ],
              });
              if (result.isError) throw new Error('Message failed');
              setNotice(
                l(
                  'Improvement request sent to the conversation. Changes will need review.',
                  'Demande envoyée à la conversation. Les modifications devront être révisées.',
                ),
              );
            })
          }
        />
      )}
      {detail && (
        <section aria-label={l('Section preview', 'Aperçu de section')}>
          <pre className="section-preview">{detail}</pre>
        </section>
      )}
    </LanguageProvider>
  );
}
createRoot(document.getElementById('root')!).render(<SpecApp />);
