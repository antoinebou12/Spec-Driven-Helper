import { Plus, Trash2 } from 'lucide-react';
import { Button, Switch } from './ui';
import { useL, useLocalized } from '../i18n';
import { listOf, matrixOf, rowsOf } from '../../../../packages/shared/src/markdown';
import { tableKinds, type Question } from '../../../../packages/shared/src/templates';

/** Table-like answers are stored as JSON rows; legacy free text becomes the first cell. */
export function tableRows(value: string, width: number): string[][] {
  const rows = rowsOf(value);
  if (rows && rows.length) return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
  return [Array.from({ length: width }, (_, i) => (i === 0 ? value : ''))];
}

export function AnswerControl({
  id,
  question,
  value,
  onChange,
  onBlur,
  disabled,
  describedBy,
}: {
  id: string;
  question: Question;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const l = useL();
  const loc = useLocalized();
  if (tableKinds.includes(question.kind)) {
    const columns = question.columns ?? [];
    const rows = tableRows(value, columns.length);
    const set = (next: string[][]) => onChange(JSON.stringify(next));
    const priorityColumn = question.kind === 'requirements' ? 2 : -1;
    return (
      <div className="table-editor" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.en} scope="col">
                  {loc(c)}
                </th>
              ))}
              <th>
                <span className="sr-only">{l('Actions', 'Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    {c === priorityColumn && question.options ? (
                      <select
                        aria-label={`${loc(columns[c])} ${r + 1}`}
                        value={cell}
                        disabled={disabled}
                        onBlur={onBlur}
                        onChange={(e) => set(rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)))}
                      >
                        <option value="">—</option>
                        {question.options.map((o) => (
                          <option key={o.en} value={o.en}>
                            {loc(o)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        rows={1}
                        aria-label={`${loc(columns[c])} ${r + 1}`}
                        value={cell}
                        disabled={disabled}
                        onBlur={onBlur}
                        onChange={(e) => set(rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)))}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={disabled || rows.length === 1}
                    aria-label={l(`Remove row ${r + 1}`, `Supprimer la ligne ${r + 1}`)}
                    onClick={() => set(rows.filter((_, i) => i !== r))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => set([...rows, columns.map(() => '')])}>
          <Plus size={14} />
          {l('Add row', 'Ajouter une ligne')}
        </Button>
      </div>
    );
  }
  if (question.kind === 'slider' && question.range) {
    const { min, max, step, unit } = question.range;
    const number = Number(value);
    const set = (v: string) => onChange(v === '' ? '' : String(Math.min(max, Math.max(min, Number(v)))));
    return (
      <div className="slider-answer" aria-describedby={describedBy}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value === '' || Number.isNaN(number) ? min : number}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          aria-valuetext={value === '' ? l('Not set', 'Non défini') : `${value}${unit ? ` ${loc(unit)}` : ''}`}
          onChange={(e) => set(e.target.value)}
          onBlur={onBlur}
        />
        <label className="slider-number">
          <span className="sr-only">{l('Exact value', 'Valeur exacte')}</span>
          <input type="number" min={min} max={max} step={step} value={value} disabled={disabled} placeholder={l('Not set', 'Non défini')} onChange={(e) => set(e.target.value)} onBlur={onBlur} />
          {unit && <span aria-hidden>{loc(unit)}</span>}
        </label>
        <small className="muted">
          {min}–{max}
          {unit ? ` ${loc(unit)}` : ''}
        </small>
      </div>
    );
  }
  if (question.kind === 'matrix' && question.rows && question.options) {
    const map = matrixOf(value);
    const choose = (row: string, option: string) => onChange(JSON.stringify({ ...map, [row]: option }));
    return (
      <div className="matrix-answer table-scroll" aria-describedby={describedBy} onBlur={onBlur}>
        <table className="data-table compact">
          <caption className="sr-only">{loc(question.prompt)}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{l('Item', 'Élément')}</span>
              </th>
              {question.options.map((o) => (
                <th scope="col" key={o.en}>
                  {loc(o)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.rows.map((r) => (
              <tr key={r.en}>
                <th scope="row">{loc(r)}</th>
                {question.options!.map((o) => (
                  <td key={o.en}>
                    <label className="check-label matrix-cell">
                      <input type="radio" name={`${id}-${r.en}`} checked={map[r.en] === o.en} disabled={disabled} onChange={() => choose(r.en, o.en)} />
                      <span className="sr-only">
                        {loc(r)}: {loc(o)}
                      </span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (question.kind === 'switch')
    return (
      <div className="switch-answer" aria-describedby={describedBy}>
        <Switch
          id={id}
          checked={value === 'yes'}
          disabled={disabled}
          onChange={(on) => {
            onChange(on ? 'yes' : 'no');
            onBlur?.();
          }}
          label={value === 'yes' ? l('Yes', 'Oui') : value === 'no' ? l('No', 'Non') : l('Not decided — switch on for yes', 'Non décidé — activez pour oui')}
        />
        {value === '' && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange('no')}>
            {l('Answer no', 'Répondre non')}
          </Button>
        )}
      </div>
    );
  if (question.kind === 'multi' && question.options) {
    const selected = listOf(value);
    const extra = selected.filter((v) => !question.options!.some((o) => o.en === v));
    const toggle = (v: string) =>
      onChange(JSON.stringify(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]));
    return (
      <fieldset className="multi-answer" aria-describedby={describedBy} onBlur={onBlur}>
        <legend className="sr-only">{loc(question.prompt)}</legend>
        {[...question.options.map((o) => ({ value: o.en, label: loc(o) })), ...extra.map((v) => ({ value: v, label: v }))].map((o) => (
          <label key={o.value} className={`chip-option ${selected.includes(o.value) ? 'on' : ''}`}>
            <input type="checkbox" checked={selected.includes(o.value)} disabled={disabled} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </fieldset>
    );
  }
  if (question.kind === 'choice' && question.options)
    return (
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
      >
        <option value="">{l('Choose…', 'Choisir…')}</option>
        {question.options.map((o) => (
          <option key={o.en} value={o.en}>
            {loc(o)}
          </option>
        ))}
      </select>
    );
  return (
    <textarea
      id={id}
      className="answer-input"
      rows={Math.min(12, Math.max(4, value.split('\n').length + 1))}
      value={value}
      disabled={disabled}
      placeholder={l('Write your answer…', 'Écrivez votre réponse…')}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy}
    />
  );
}
