import { useEffect, useId, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useL } from '../i18n';

const markers = /<!-- sdd:(?:answer [\w.-]+|end) -->\n?/g;
/** Only web and mail links render as links; everything else becomes inert text. */
const safeUrl = (url: string) => (/^(https?:|mailto:|#)/i.test(url) ? defaultUrlTransform(url) : '');

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={safeUrl}
        components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" /> }}
      >
        {text.replace(markers, '')}
      </ReactMarkdown>
    </div>
  );
}

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  mermaidReady ??= import('mermaid').then(({ default: mermaid }) => mermaid);
  return mermaidReady;
}

/** Renders Mermaid in strict mode: no scripts, no click bindings, sanitized labels. */
export function Diagram({ code, label }: { code: string; label?: string }) {
  const l = useL();
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (!code.trim()) {
      setSvg('');
      return;
    }
    const timer = setTimeout(async () => {
      const mermaid = await loadMermaid();
      const dark = document.documentElement.dataset.theme === 'dark';
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' });
      try {
        const result = await mermaid.render(`diagram-${id}-${Date.now()}`, code);
        if (alive) {
          setSvg(result.svg);
          setError('');
        }
      } catch {
        if (alive) setError(l('The diagram source is invalid. Edit it to continue.', 'La source du diagramme est invalide. Modifiez-la pour continuer.'));
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [code, id, l]);
  return (
    <figure className="diagram" aria-label={label ?? l('Diagram', 'Diagramme')}>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : (
        // Mermaid output is generated in strict security mode (DOMPurify-sanitized SVG).
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {svg && !error && (
        <figcaption className="diagram-actions">
          <a
            className="button small ghost"
            download={`${(label ?? 'diagram').replace(/[^\w-]+/g, '-').toLowerCase()}.svg`}
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          >
            {l('Download SVG', 'Télécharger le SVG')}
            {label && <span className="sr-only"> {label}</span>}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
