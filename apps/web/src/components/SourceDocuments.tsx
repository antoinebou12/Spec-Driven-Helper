import { useL } from '../i18n';

/** Source text stays escaped and inert, including any embedded agent instructions. */
export function SourceDocuments({ files }: { files: Record<string, string> }) {
  const l = useL();
  if (!Object.keys(files).length) return null;
  return (
    <details>
      <summary>{l('Source documents', 'Documents sources')}</summary>
      {Object.entries(files).map(([path, content]) => (
        <details key={path}>
          <summary>{path}</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {content}
          </pre>
        </details>
      ))}
    </details>
  );
}
