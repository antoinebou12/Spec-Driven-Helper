import { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CheckCircle2, CircleDashed, ExternalLink, Layers3, Send, Sparkles, X } from 'lucide-react';
import { Badge, Button } from '../ui';
import { useL } from '../../i18n';
import { stackLayers, type StackEntry, type StackLayer, type Technology } from '../../../../../packages/shared/src/schema';
import { layerInfo, preferredVersion } from '../../../../../packages/shared/src/stack';
import { enterFrom, spring } from '../../motion';
import '../../builder.css';

/**
 * Interactive cards the builder's AI shows inside the conversation (AG-UI frontend tools). Each card
 * is presentational: it gets the model's arguments and calls `onAnswer` once with the user's reply.
 * After answering, a card stays in the transcript as a compact, read-only record.
 */
export function CardShell({ icon, title, answered, children }: { icon: React.ReactNode; title: string; answered?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const headingId = useId();
  return (
    <motion.section
      className={`builder-card${answered ? ' answered' : ''}`}
      aria-labelledby={headingId}
      // Rises into place and settles: a card that just appeared carried no momentum, so no overshoot.
      initial={enterFrom(reduce, { opacity: 0, y: 8 })}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.ui}
    >
      <h4 id={headingId} className="builder-card-title">
        {icon}
        <span>{title}</span>
      </h4>
      {answered ? (
        <p className="builder-card-answer">
          <CheckCircle2 size={14} aria-hidden /> {answered}
        </p>
      ) : (
        children
      )}
    </motion.section>
  );
}

export function ChoiceCard({ question, options, multiple, answered, onAnswer }: { question: string; options: string[]; multiple?: boolean; answered?: string; onAnswer: (reply: string) => void }) {
  const l = useL();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <CardShell icon={<Sparkles size={15} aria-hidden />} title={question} answered={answered}>
      <div className="choice-chips" role={multiple ? 'group' : undefined} aria-label={question}>
        {options.map((o) =>
          multiple ? (
            <button key={o} type="button" className={`chip${picked.includes(o) ? ' on' : ''}`} aria-pressed={picked.includes(o)} onClick={() => toggle(o)}>
              {picked.includes(o) && <Check size={13} aria-hidden />} {o}
            </button>
          ) : (
            <button key={o} type="button" className="chip" onClick={() => onAnswer(o)}>
              {o}
            </button>
          ),
        )}
      </div>
      {multiple && (
        <Button size="sm" variant="primary" disabled={!picked.length} onClick={() => onAnswer(picked.join(', '))}>
          <Send size={13} aria-hidden /> {l('Send', 'Envoyer')}
        </Button>
      )}
    </CardShell>
  );
}

export function ScaleCard({ question, min, max, step, unit, suggestion, answered, onAnswer }: { question: string; min: number; max: number; step?: number; unit?: string; suggestion?: number; answered?: string; onAnswer: (reply: string) => void }) {
  const l = useL();
  const lo = Math.min(min, max),
    hi = Math.max(min, max);
  const [value, setValue] = useState(() => Math.min(hi, Math.max(lo, suggestion ?? (lo + hi) / 2)));
  const id = useId();
  const pct = hi > lo ? ((value - lo) / (hi - lo)) * 100 : 0;
  return (
    <CardShell icon={<CircleDashed size={15} aria-hidden />} title={question} answered={answered}>
      <label htmlFor={id} className="sr-only">
        {question}
      </label>
      <div className="scale-row">
        <input id={id} type="range" min={lo} max={hi} step={step ?? 'any'} value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ ['--pct' as string]: `${pct}%` }} />
        <output htmlFor={id} className="scale-value">
          {value}
          {unit ? ` ${unit}` : ''}
        </output>
      </div>
      <Button size="sm" variant="primary" onClick={() => onAnswer(`${value}${unit ? ` ${unit}` : ''}`)}>
        <Send size={13} aria-hidden /> {l('Send', 'Envoyer')}
      </Button>
    </CardShell>
  );
}

export function TextCard({ question, placeholder, answered, onAnswer }: { question: string; placeholder?: string; answered?: string; onAnswer: (reply: string) => void }) {
  const l = useL();
  const [text, setText] = useState('');
  return (
    <CardShell icon={<Sparkles size={15} aria-hidden />} title={question} answered={answered}>
      <form
        className="text-card-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onAnswer(text.trim());
        }}
      >
        <textarea rows={2} value={text} placeholder={placeholder} aria-label={question} onChange={(e) => setText(e.target.value)} maxLength={4000} />
        <Button size="sm" variant="primary" type="submit" disabled={!text.trim()}>
          <Send size={13} aria-hidden /> {l('Send', 'Envoyer')}
        </Button>
      </form>
    </CardShell>
  );
}

/** Where a picked technology goes by default; the user can change it before saving. */
const frontendHints = /react|vue|angular|svelte|next|nuxt|astro|tailwind|vite|remix|solid/i;
export function defaultLayer(t: Technology): StackLayer {
  const byCategory: Partial<Record<Technology['category'], StackLayer>> = {
    database: 'data',
    search: 'data',
    storage: 'data',
    messaging: 'communication',
    contract: 'contracts',
    platform: 'infrastructure',
    cloud: 'infrastructure',
    networking: 'infrastructure',
    identity: 'backend',
    os: 'infrastructure',
    iac: 'iac',
    'ci-cd': 'cicd',
    testing: 'testing',
    development: 'development',
    tooling: 'development',
    observability: 'observability',
    security: 'backend',
    ai: 'ai',
  };
  return byCategory[t.category] ?? (frontendHints.test(`${t.name} ${t.tags.join(' ')}`) ? 'frontend' : 'backend');
}

/**
 * Stack picker: suggested technologies are pre-selected; saving adds them to the project stack
 * (the user's own action, like the Stack page) and tells the AI what was chosen.
 */
export function StackPickCard({
  question,
  suggestions = [],
  catalog,
  current,
  lang,
  editable,
  answered,
  onSave,
}: {
  question: string;
  suggestions?: string[];
  catalog: Technology[];
  current: StackEntry[];
  lang: 'en' | 'fr';
  editable: boolean;
  answered?: string;
  onSave: (entries: StackEntry[], names: string[]) => void;
}) {
  const l = useL();
  const [query, setQuery] = useState('');
  const initial = useMemo(() => catalog.filter((t) => suggestions.some((s) => s.toLowerCase() === t.name.toLowerCase() || t.tags.includes(s.toLowerCase()))).map((t) => t.id), [catalog, suggestions]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? initial;
  const [layers, setLayers] = useState<Record<string, StackLayer>>({});
  const inStack = new Set(current.map((e) => e.technologyId));
  const matches = catalog
    .filter((t) => !inStack.has(t.id) && `${t.name} ${t.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(chosen.includes(b.id)) - Number(chosen.includes(a.id)))
    .slice(0, 18);
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const selected = chosen.map((id) => catalog.find((t) => t.id === id)).filter((t): t is Technology => !!t);
  return (
    <CardShell icon={<Layers3 size={15} aria-hidden />} title={question} answered={answered}>
      <input type="search" className="stack-card-search" placeholder={l('Search the catalog', 'Rechercher dans le catalogue')} aria-label={l('Search the catalog', 'Rechercher dans le catalogue')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="choice-chips">
        {matches.map((t) => (
          <button key={t.id} type="button" className={`chip${chosen.includes(t.id) ? ' on' : ''}`} aria-pressed={chosen.includes(t.id)} onClick={() => toggle(t.id)}>
            {chosen.includes(t.id) && <Check size={13} aria-hidden />} {t.name}
          </button>
        ))}
        {!matches.length && <span className="muted small">{l('No technology matches.', 'Aucune technologie ne correspond.')}</span>}
      </div>
      {selected.length > 0 && (
        <ul className="stack-card-picked">
          {selected.map((t) => (
            <li key={t.id}>
              <span>{t.name}</span>
              <select aria-label={l(`Layer for ${t.name}`, `Couche pour ${t.name}`)} value={layers[t.id] ?? defaultLayer(t)} onChange={(e) => setLayers({ ...layers, [t.id]: e.target.value as StackLayer })}>
                {stackLayers.map((layer) => (
                  <option key={layer} value={layer}>
                    {layerInfo[layer].label[lang]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="primary"
        disabled={!selected.length || !editable}
        onClick={() =>
          onSave(
            selected.map((t) => ({ technologyId: t.id, layer: layers[t.id] ?? defaultLayer(t), version: preferredVersion(t, true), note: '' })),
            selected.map((t) => t.name),
          )
        }
      >
        <Check size={13} aria-hidden /> {l(`Add ${selected.length} to the stack`, `Ajouter ${selected.length} à la pile`)}
      </Button>
    </CardShell>
  );
}

export type ChatProposal = { proposalId: string; title: string; changes: number; status: 'pending' | 'accepted' | 'rejected' };

/** A proposal made in the conversation, reviewable where it appears. */
export function ProposalCard({
  proposal,
  error,
  running,
  canReview,
  onAccept,
  onReject,
  onOpen,
}: {
  proposal?: ChatProposal;
  error?: string;
  running?: boolean;
  canReview: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onOpen: () => void;
}) {
  const l = useL();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const act = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setFailure('');
    try {
      await fn();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (running) return <p className="builder-note">{l('Preparing a proposal…', 'Préparation d’une proposition…')}</p>;
  if (error) return <p className="builder-note muted small">{l('The AI will retry that change: ', 'L’IA va reformuler ce changement : ')}{error}</p>;
  if (!proposal) return null;
  const decided = proposal.status !== 'pending';
  return (
    <CardShell icon={<Sparkles size={15} aria-hidden />} title={proposal.title}>
      <p className="muted small">
        {decided
          ? l(`${proposal.changes} change${proposal.changes === 1 ? '' : 's'}`, `${proposal.changes} changement${proposal.changes === 1 ? '' : 's'}`)
          : l(`${proposal.changes} change${proposal.changes === 1 ? '' : 's'} waiting for review`, `${proposal.changes} changement${proposal.changes === 1 ? '' : 's'} à réviser`)}{' '}
        {decided && <Badge tone={proposal.status === 'accepted' ? 'green' : 'neutral'}>{proposal.status === 'accepted' ? l('accepted', 'acceptée') : l('rejected', 'rejetée')}</Badge>}
      </p>
      <div className="inline-actions">
        {!decided && canReview && (
          <>
            <Button size="sm" variant="primary" disabled={busy} onClick={act(onAccept)}>
              <Check size={13} aria-hidden /> {l('Accept', 'Accepter')}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={act(onReject)}>
              <X size={13} aria-hidden /> {l('Reject', 'Rejeter')}
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onOpen}>
          <ExternalLink size={13} aria-hidden /> {l('Details', 'Détails')}
        </Button>
      </div>
      {!canReview && !decided && <p className="muted small">{l('A reviewer will accept or reject it.', 'Un réviseur l’acceptera ou la rejettera.')}</p>}
      {failure && (
        <p className="error-text small" role="alert">
          {failure}
        </p>
      )}
    </CardShell>
  );
}
