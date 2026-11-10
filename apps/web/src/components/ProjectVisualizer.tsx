import { useState } from 'react';
import { specVisual } from '../../../../packages/shared/src/spec-visualizer';
import type { Spec } from '../../../../packages/shared/src/schema';
import { useLang, useL } from '../i18n';
import { SpecVisualizer } from './SpecVisualizer';

export function ProjectVisualizer({
  spec,
  onSection,
}: {
  spec: Spec;
  onSection: (id: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const l = useL();
  const total = spec.items.filter((item) => item.status !== 'superseded').length;
  const page = Math.min(offset, Math.max(0, Math.ceil(total / 24) - 1) * 24);
  return (
    <details className="overview-section compact-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{l('Specification visualizer', 'Visualiseur de spécification')}</summary>
      {open && <SpecVisualizer
        data={specVisual(spec, page, lang)}
        onPage={setOffset}
        onSection={onSection}
      />}
    </details>
  );
}
