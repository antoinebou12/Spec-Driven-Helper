import { useId, useState } from 'react';
import { Download } from 'lucide-react';
import { useL } from '../i18n';
import { OpenSpecExport } from './OpenSpecExport';

export type ExportFormat = { id: string; title: string; note: string };
export type ExportGroup = { id: string; ids: string[]; title: string };

export function ExportPicker({
  projectId,
  formats,
  groups,
}: {
  projectId: string;
  formats: ExportFormat[];
  groups: ExportGroup[];
}) {
  const l = useL();
  const noteId = useId();
  const [selected, setSelected] = useState('zip');
  const format = formats.find((f) => f.id === selected) ?? formats[0];
  if (!format) return null;
  return (
    <div className="form-stack export-picker">
      <div className="export-controls">
        <label>
          {l('Export format', 'Format d’export')}
          <select
            value={format.id}
            onChange={(e) => setSelected(e.target.value)}
            aria-describedby={noteId}
          >
            {groups.map((group) => (
              <optgroup key={group.id} label={group.title}>
                {formats
                  .filter((f) => group.ids.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {format.id !== 'openspec' && (
          <a
            className="button primary"
            href={`/api/v1/projects/${projectId}/export/${format.id}`}
            download
          >
            <Download size={16} aria-hidden /> {l('Download', 'Télécharger')}
          </a>
        )}
      </div>
      <p id={noteId} className="muted small">
        {format.note}
      </p>
      {format.id === 'openspec' && <OpenSpecExport key={projectId} projectId={projectId} />}
    </div>
  );
}
