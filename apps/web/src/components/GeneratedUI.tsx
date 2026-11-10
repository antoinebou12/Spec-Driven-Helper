import { createContext, useContext, useState } from 'react';
import { createLibrary, defineComponent, Renderer } from '@openuidev/react-lang';
import { z } from 'zod';
import { generatedFormSchema, type GeneratedUI } from '../../../../packages/shared/src/schema';
import { findQuestion } from '../../../../packages/shared/src/templates';
import { Button } from './ui';
import { Diagram } from './Markdown';
import { AnswerControl } from './AnswerControl';
import { useL } from '../i18n';

/**
 * Approved component library for model-proposed controls. The model only supplies validated
 * data; this file decides what renders. Submissions go to an endpoint that re-validates the
 * control and value server-side.
 */
type Submit = (index: number, value: string) => Promise<void>;
const Context = createContext<{ submit: Submit; disabled: boolean }>({ submit: async () => {}, disabled: true });

function Control({ index, questionId, label, help, children }: { index: number; questionId: string; label: string; help: string; children: (value: string, set: (v: string) => void) => React.ReactNode }) {
  const { submit, disabled } = useContext(Context);
  const l = useL();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="generated-control">
      <strong id={`gen-${index}-label`}>{label}</strong>
      <small className="muted">{questionId}</small>
      {help && <p className="muted">{help}</p>}
      {children(value, setValue)}
      <Button
        size="sm"
        variant="primary"
        disabled={disabled || busy || !value.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await submit(index, value);
            setDone(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {done ? l('Saved', 'Enregistré') : l('Save this answer', 'Enregistrer cette réponse')}
      </Button>
    </div>
  );
}
const base = { index: z.number(), questionId: z.string(), label: z.string(), help: z.string() };
const TextField = defineComponent({
  name: 'TextField',
  description: 'Free-text answer to one template question',
  props: z.object({ ...base, suggestion: z.string() }),
  component: ({ props }) => (
    <Control {...props}>
      {(value, set) => (
        <textarea aria-labelledby={`gen-${props.index}-label`} rows={3} value={value || ''} placeholder={props.suggestion} onChange={(e) => set(e.target.value)} />
      )}
    </Control>
  ),
});
const Choice = defineComponent({
  name: 'Choice',
  description: 'Single choice among offered options',
  props: z.object({ ...base, options: z.array(z.string()) }),
  component: ({ props }) => (
    <Control {...props}>
      {(value, set) => (
        <div role="radiogroup" aria-labelledby={`gen-${props.index}-label`} className="choice-list">
          {props.options.map((o) => (
            <label key={o} className="check-label">
              <input type="radio" name={`gen-${props.index}`} checked={value === o} onChange={() => set(o)} />
              {o}
            </label>
          ))}
        </div>
      )}
    </Control>
  ),
});
const TableInput = defineComponent({
  name: 'TableInput',
  description: 'Rows for a table, RACI, requirements or comparison question',
  props: z.object({ ...base, suggestion: z.string() }),
  component: ({ props }) => {
    const question = findQuestion(props.questionId);
    return (
      <Control {...props}>
        {(value, set) =>
          question ? <AnswerControl id={`gen-${props.index}`} question={question} value={value || props.suggestion} onChange={set} /> : null
        }
      </Control>
    );
  },
});
const DiagramPreview = defineComponent({
  name: 'DiagramPreview',
  description: 'Mermaid diagram preview for a section',
  props: z.object({ ...base, code: z.string() }),
  component: function DiagramPreviewControl({ props }) {
    const { submit, disabled } = useContext(Context);
    const l = useL();
    return (
      <div className="generated-control">
        <strong>{props.label}</strong>
        {props.help && <p className="muted">{props.help}</p>}
        <Diagram code={props.code} label={props.label} />
        <Button size="sm" disabled={disabled} onClick={() => submit(props.index, '')}>
          {l('Use this diagram', 'Utiliser ce diagramme')}
        </Button>
      </div>
    );
  },
});
const library = createLibrary({ components: [TextField, Choice, TableInput, DiagramPreview] });

function source(c: GeneratedUI, index: number) {
  const args = (...values: unknown[]) => values.map((v) => JSON.stringify(v)).join(', ');
  const common = [index, c.questionId, c.label, c.help ?? ''];
  if (c.kind === 'diagram') return `root = DiagramPreview(${args(...common, c.code ?? '')})`;
  if (c.kind === 'choice') return `root = Choice(${args(...common, c.options ?? [])})`;
  if (c.kind === 'text') return `root = TextField(${args(...common, c.suggestion ?? '')})`;
  return `root = TableInput(${args(...common, c.suggestion ?? '')})`;
}

export default function GeneratedUIForm({ ui, onSubmit, disabled }: { ui: unknown; onSubmit: Submit; disabled: boolean }) {
  const l = useL();
  const parsed = generatedFormSchema.safeParse(ui);
  if (!parsed.success || !parsed.data.length)
    return <p className="muted">{l('Use the guided interview to answer follow-up questions.', 'Utilisez l’entretien guidé pour répondre aux questions de suivi.')}</p>;
  return (
    <Context.Provider value={{ submit: onSubmit, disabled }}>
      <div className="generated-form">
        {parsed.data.map((control, i) => (
          <Renderer key={i} library={library} response={source(control, i)} isStreaming={false} publishObservability={false} />
        ))}
      </div>
    </Context.Provider>
  );
}
