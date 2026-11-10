import { useEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from '../hooks';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleHelp,
  ListChecks,
  Sparkles,
  Users,
} from 'lucide-react';
import { AnswerControl, tableRows } from '../components/AnswerControl';
import { Badge, Button, Segmented } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { moduleIcons } from '../icons';
import { useL, useLocalized } from '../i18n';
import { useFeatures } from '../features';
import { useDebouncedSave, useLocalStorage, type ProjectState } from '../state';
import { answerStatus, nextItemId } from '../../../../packages/shared/src/domain';
import { rowsOf } from '../../../../packages/shared/src/markdown';
import {
  moduleQuestions,
  type Module,
  type Question,
} from '../../../../packages/shared/src/templates';
import type { Answer, Item, Section } from '../../../../packages/shared/src/schema';

export type Guidance = Record<
  string,
  { text: string; references: { id: string; title: string; url: string }[] }
>;
type Draft = { value: string; state: Answer['state']; reason: string };
const toDraft = (a?: Answer): Draft => ({
  value: a?.value ?? '',
  state: a?.state ?? 'answered',
  reason: a?.reason ?? '',
});
const same = (a: Draft, b: Draft) =>
  a.value === b.value && a.state === b.state && a.reason === b.reason;
export const batchSize = 3;

function QuestionCard({
  question,
  section,
  project,
  editable,
  expert,
  guidance,
  onAskAi,
  focusRef,
}: {
  question: Question;
  section: Section;
  project: ProjectState;
  editable: boolean;
  expert: boolean;
  guidance?: Guidance[string];
  onAskAi: (prompt: string, questionId?: string) => void;
  focusRef?: (el: HTMLElement | null) => void;
}) {
  const l = useL();
  const ai = useFeatures().on('ai');
  const loc = useLocalized();
  const stored = section.answers[question.id];
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(stored));
  const saved = useRef<Draft>(toDraft(stored));
  const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const dirty = !same(draft, saved.current);
  // Adopt newer stored answers (teammates, accepted proposals) unless the author is mid-edit.
  const storedKey = JSON.stringify(stored ?? null);
  const epoch = useRef(project.epoch);
  const latest = useLatest({ stored, dirty });
  useEffect(() => {
    const next = toDraft(latest.current.stored);
    // A discarded conflict resets the draft even though it differs from the stored answer.
    if (!latest.current.dirty || epoch.current !== project.epoch) setDraft(next);
    epoch.current = project.epoch;
    saved.current = next;
  }, [storedKey, project.epoch, latest]);
  const valid = draft.state !== 'not-applicable' || draft.reason.trim().length > 0;
  const persist = async (value: Draft) => {
    if (!valid || !editable) return;
    setStatus('saving');
    const result = await project.save(
      { sections: [{ id: section.id, answers: { [question.id]: value } }] },
      loc(question.label),
    );
    if (result) saved.current = value;
    setStatus(result ? 'saved' : 'unsaved');
  };
  const flush = useDebouncedSave(draft, dirty && valid, persist);
  useEffect(() => {
    if (dirty) setStatus('unsaved');
  }, [dirty]);
  const id = `q-${question.id.replace('.', '-')}`;

  const createItems = async () => {
    const rows = rowsOf(draft.value) ?? [];
    const spec = project.spec!;
    const items: Item[] = [];
    const assigned = rows.map((row) => {
      if (!row[1]?.trim()) return row;
      const existing = spec.items.find((i) => i.id === row[0]?.trim());
      const itemId =
        existing?.id ??
        (/^REQ-\d+$/.test(row[0]?.trim() ?? '')
          ? row[0].trim()
          : nextItemId({ items: [...spec.items, ...items] }, 'requirement'));
      const priority = (
        { Must: 'must', Should: 'should', Could: 'could', 'Won’t': 'wont' } as const
      )[row[2] as 'Must'];
      items.push({
        ...(existing ?? { body: '', status: 'draft', owner: '', needsReview: false }),
        id: itemId,
        type: 'requirement',
        title: row[1].trim().slice(0, 500),
        acceptance: row[3]?.trim() ?? existing?.acceptance ?? '',
        ...(priority ? { priority } : {}),
      } as Item);
      return [itemId, ...row.slice(1)];
    });
    const value = { ...draft, value: JSON.stringify(assigned) };
    setDraft(value);
    const result = await project.save(
      { items, sections: [{ id: section.id, answers: { [question.id]: value } }] },
      l('Requirements', 'Exigences'),
    );
    if (result) saved.current = value;
  };

  return (
    <article
      className={`question-card ${answerStatus(stored)}`}
      ref={focusRef}
      tabIndex={-1}
      aria-labelledby={`${id}-label`}
    >
      <header>
        <span className="question-id">{question.id}</span>
        <Badge tone={question.required ? 'blue' : 'neutral'}>
          {question.required ? l('Required', 'Obligatoire') : l('Optional', 'Facultatif')}
        </Badge>
        {question.origin && (
          <Badge tone={question.origin === 'ai' ? 'violet' : 'amber'}>
            {
              {
                rule: l('From your stack', 'Selon votre pile'),
                ai: l('AI-proposed', 'Proposée par l’IA'),
                manual: l('Team question', 'Question d’équipe'),
              }[question.origin]
            }
          </Badge>
        )}
        <span className={`save-dot ${status}`} role="status" aria-live="polite">
          {status === 'saving'
            ? l('Saving…', 'Enregistrement…')
            : status === 'unsaved'
              ? valid
                ? l('Unsaved', 'Non enregistré')
                : l('Reason needed', 'Raison requise')
              : stored
                ? l('Saved', 'Enregistré')
                : ''}
        </span>
        <Button
          size="icon"
          variant="ghost"
          title={l('Help and example', 'Aide et exemple')}
          aria-label={l('Help and example', 'Aide et exemple')}
          aria-expanded={helpOpen}
          aria-controls={`${id}-help`}
          onClick={() => setHelpOpen(!helpOpen)}
        >
          <BookOpen size={15} aria-hidden />
        </Button>
        {editable && ai && (
          <Button
            size="icon"
            variant="ghost"
            title={l('Ask AI', 'Demander à l’IA')}
            aria-label={l('Ask AI', 'Demander à l’IA')}
            onClick={() =>
              onAskAi(
                l(
                  `Help me answer “${loc(question.prompt)}” (${question.id}). Suggest an answer based on this project and propose it for review.`,
                  `Aidez-moi à répondre à « ${loc(question.prompt)} » (${question.id}). Suggérez une réponse fondée sur ce projet et proposez-la pour révision.`,
                ),
                question.id,
              )
            }
          >
            <Sparkles size={15} aria-hidden />
          </Button>
        )}
      </header>
      <h3 id={`${id}-label`}>{loc(question.prompt)}</h3>
      <div id={`${id}-help`} hidden={!helpOpen}>
        {expert ? (
          <p className="hint">{loc(question.hint)}</p>
        ) : (
          <p className="explain">{loc(question.explain)}</p>
        )}
        {question.example.en && <p className="example">{loc(question.example)}</p>}
        {guidance?.text && (
          <div className="team-guidance">
            <Users size={14} aria-hidden /> <Markdown text={guidance.text} />
          </div>
        )}
      </div>
      <fieldset disabled={!editable}>
        <legend className="sr-only">{loc(question.label)}</legend>
        <Segmented
          label={l('Answer status', 'Statut de la réponse')}
          value={draft.state}
          onChange={(state) => setDraft({ ...draft, state })}
          items={[
            { id: 'answered', label: l('Answer', 'Réponse') },
            { id: 'unknown', label: l('Unknown', 'Inconnu') },
            { id: 'not-applicable', label: l('N/A', 'S.O.') },
          ]}
        />
        {draft.state === 'not-applicable' ? (
          <label>
            {l('Why does this not apply?', 'Pourquoi cela ne s’applique-t-il pas ?')}
            <input
              value={draft.reason}
              required
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              onBlur={flush}
              placeholder={l(
                'e.g. Internal tool with no revenue model',
                'p. ex. Outil interne sans modèle de revenus',
              )}
            />
          </label>
        ) : (
          <>
            {draft.state === 'unknown' && (
              <p className="muted small">
                {l(
                  'Unresolved: blocks baseline approval.',
                  'À résoudre : bloque l’approbation de la référence.',
                )}
              </p>
            )}
            <label className="sr-only" htmlFor={id}>
              {loc(question.prompt)}
            </label>
            <AnswerControl
              id={id}
              question={question}
              value={draft.value}
              describedBy={helpOpen ? `${id}-help` : undefined}
              onChange={(value) => setDraft({ ...draft, value })}
              onBlur={flush}
            />
          </>
        )}
      </fieldset>
      <div className="question-tools">
        {question.origin && editable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              project.save({ removeCustomQuestions: [question.id] }, loc(question.label))
            }
          >
            {l('Remove this question', 'Retirer cette question')}
          </Button>
        )}
        {question.kind === 'requirements' &&
          editable &&
          tableRows(draft.value, 4).some((r) => r[1]?.trim()) && (
            <Button size="sm" onClick={createItems}>
              <ListChecks size={14} />{' '}
              {l('Create traceable requirements', 'Créer des exigences traçables')}
            </Button>
          )}
      </div>
    </article>
  );
}

export function InterviewPanel({
  module,
  section,
  project,
  editable,
  guidance,
  focusQuestion,
  onFocused,
  onNextModule,
  onAskAi,
}: {
  module: Module;
  section: Section;
  project: ProjectState;
  editable: boolean;
  guidance: Guidance;
  focusQuestion: string | null;
  onFocused: () => void;
  onNextModule: () => void;
  onAskAi: (prompt: string, questionId?: string) => void;
}) {
  const l = useL();
  const ai = useFeatures().on('ai');
  const loc = useLocalized();
  const [expert, setExpert] = useLocalStorage('sdd-expert', false);
  const [view, setView] = useLocalStorage<'focus' | 'all'>('sdd-interview-view', 'focus');
  const [cursor, setCursor] = useState(0);
  const spec = project.spec!;
  const { projectType, customQuestions } = spec;
  const questions = useMemo(
    () => moduleQuestions(module, { projectType, customQuestions }),
    [module, projectType, customQuestions],
  );
  const cards = useRef(new Map<string, HTMLElement>());
  // Only a module change moves the cursor; answering must not jump the view.
  const latest = useLatest({ questions, answers: section.answers, onFocused });
  useEffect(() => {
    const { questions, answers } = latest.current;
    const first = questions.findIndex((q) => answerStatus(answers[q.id]) === 'empty');
    setCursor(first < 0 ? 0 : Math.floor(first / batchSize) * batchSize);
  }, [module.id, latest]);
  useEffect(() => {
    if (!focusQuestion) return;
    const { questions, onFocused } = latest.current;
    const index = questions.findIndex((q) => q.id === focusQuestion);
    if (index >= 0) {
      setCursor(index);
      requestAnimationFrame(() => {
        const card = cards.current.get(focusQuestion);
        card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        card?.focus();
      });
    }
    onFocused();
  }, [focusQuestion, latest]);
  const shown = view === 'all' ? questions : questions.slice(cursor, cursor + batchSize);
  const answered = questions.filter((q) => answerStatus(section.answers[q.id]) !== 'empty').length;
  const last = cursor + batchSize >= questions.length;
  const move = (direction: 1 | -1) => {
    if (direction > 0 && last) return onNextModule();
    setCursor((c) => Math.max(0, Math.min(questions.length - 1, c + direction * batchSize)));
    document.getElementById('interview-heading')?.focus();
  };
  // Keyboard: Alt+↓ / Alt+↑ moves between question groups.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || view === 'all') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const moduleGuidance = guidance[module.id];
  const ModuleIcon = moduleIcons[module.id];
  const index = project.spec!.sections.findIndex((s) => s.id === module.id);
  return (
    <section className="interview-panel" aria-labelledby="interview-heading">
      <div className="panel-heading">
        <span>
          <Sparkles size={15} aria-hidden /> {l('Form', 'Formulaire')}
        </span>
        <div className="panel-controls">
          <Segmented
            label={l('Explanation level', 'Niveau d’explication')}
            value={expert ? 'expert' : 'guided'}
            onChange={(v) => setExpert(v === 'expert')}
            items={[
              { id: 'guided', label: l('Guided', 'Guidé') },
              { id: 'expert', label: l('Expert', 'Expert') },
            ]}
          />
          <Segmented
            label={l('Questions shown', 'Questions affichées')}
            value={view}
            onChange={setView}
            items={[
              { id: 'focus', label: l('Focus', 'Ciblé') },
              { id: 'all', label: l('All', 'Toutes') },
            ]}
          />
        </div>
      </div>
      <div className="interview-body">
        <div className="section-kicker">
          {l('SECTION', 'SECTION')} {String(index + 1).padStart(2, '0')} <span>/ 14</span>
        </div>
        <h2 id="interview-heading" tabIndex={-1} className="module-title">
          <ModuleIcon size={22} aria-hidden className="section-icon" />
          {loc(module.title)}
        </h2>
        <div className="module-progress">
          <div
            className="progress-track"
            role="progressbar"
            aria-label={l('Questions answered', 'Questions répondues')}
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answered}
          >
            <span style={{ width: `${(answered / Math.max(1, questions.length)) * 100}%` }} />
          </div>
          <small>
            {answered}/{questions.length} {l('answered', 'répondues')}
          </small>
        </div>
        {!expert && (
          <details className="section-guidance">
            <summary>{l('Section guidance', 'Consignes de section')}</summary>
            <div>
              <p>{loc(module.guidance)}</p>
              {moduleGuidance?.text && (
                <div className="team-guidance">
                  <strong>
                    <Users size={14} aria-hidden /> {l('Team guidance', 'Consignes de l’équipe')}
                  </strong>
                  <Markdown text={moduleGuidance.text} />
                </div>
              )}
            </div>
          </details>
        )}
        {view === 'focus' && (
          <p className="batch-label" aria-live="polite">
            {l(
              `Questions ${cursor + 1}–${Math.min(cursor + batchSize, questions.length)} of ${questions.length}`,
              `Questions ${cursor + 1} à ${Math.min(cursor + batchSize, questions.length)} sur ${questions.length}`,
            )}
          </p>
        )}
        {shown.map((q) => (
          <QuestionCard
            key={`${module.id}-${q.id}`}
            question={q}
            section={section}
            project={project}
            editable={editable}
            expert={expert}
            guidance={guidance[q.id]}
            onAskAi={onAskAi}
            focusRef={(el) => (el ? cards.current.set(q.id, el) : cards.current.delete(q.id))}
          />
        ))}
        {view === 'focus' && (
          <nav
            className="question-navigation"
            aria-label={l('Question groups', 'Groupes de questions')}
          >
            <Button variant="ghost" disabled={cursor === 0} onClick={() => move(-1)} title="Alt+↑">
              <ArrowLeft size={15} /> {l('Previous', 'Précédent')}
            </Button>
            <Button variant={last ? 'primary' : 'secondary'} onClick={() => move(1)} title="Alt+↓">
              {l('Next', 'Suivant')}{' '}
              <ArrowRight size={15} />
            </Button>
          </nav>
        )}
        <section
          className="module-references"
          aria-label={l('Reference material', 'Documentation de référence')}
        >
          <h3>
            <CircleHelp size={15} aria-hidden />{' '}
            {l('Reference material', 'Documentation de référence')}
          </h3>
          <ul>
            {module.references.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer noopener">
                  {r.title}
                </a>{' '}
                <Badge>{l('official', 'officielle')}</Badge>
              </li>
            ))}
            {moduleGuidance?.references.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noreferrer noopener">
                  {r.title}
                </a>{' '}
                <Badge tone="blue">{l('team', 'équipe')}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer className="interview-bottom">
        {editable && ai && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskAi(
                l(
                  `Propose up to three additional questions for the “${loc(module.title)}” section that this specific project should answer, as customQuestions (ids like ${module.id}.c-short-name, origin "ai"). Do not answer them.`,
                  `Proposez jusqu’à trois questions supplémentaires pour la section « ${loc(module.title)} » propres à ce projet, sous forme de customQuestions (identifiants comme ${module.id}.c-nom-court, origine « ai »). N’y répondez pas.`,
                ),
              )
            }
          >
            <ListChecks size={14} />{' '}
            {l('Questions', 'Questions')}
          </Button>
        )}
        {editable && ai && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskAi(
                l(
                  `Review the “${loc(module.title)}” section. Point out gaps and contradictions, and propose improvements based on what is recorded.`,
                  `Révisez la section « ${loc(module.title)} ». Signalez les manques et contradictions, et proposez des améliorations à partir de ce qui est consigné.`,
                ),
              )
            }
          >
            <Sparkles size={14} />{' '}
            {l('Review', 'Réviser')}
          </Button>
        )}
      </footer>
    </section>
  );
}
