import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { z } from 'zod';
import { motion, useReducedMotion } from 'motion/react';
import { Bot, Cpu, Loader2, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import {
  CopilotChat,
  CopilotKit,
  HttpAgent,
  useAgent,
  useAgentContext,
  useCopilotKit,
  useHumanInTheLoop,
  useRenderTool,
} from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import '../builder.css';
import { api } from '../api';
import { ThreadStarter, storeThread, type ConversationEntry } from '../builder-session';
import { useLatest } from '../hooks';
import { useFeatures } from '../features';
import { Badge, Button } from '../components/ui';
import { useL, useLang } from '../i18n';
import { useLocalStorage, type ProjectState } from '../state';
import {
  ChoiceCard,
  ProposalCard,
  ScaleCard,
  StackPickCard,
  TextCard,
  type ChatProposal,
} from '../components/builder/BuilderCards';
import { InterviewChoiceCard } from '../components/builder/AnswerRecord';
import { QuestionCard } from '../components/builder/QuestionCard';
import { SpecAgent } from '../interview-agent';
import { LiveDocument } from '../components/builder/LiveDocument';
import { can } from '../../../../packages/shared/src/domain';
import { builderFrontendTools } from '../../../../packages/shared/src/builder-tools';
import { useVisualAnswers } from '../components/builder/VisualAnswerTool';
import {
  emptyMemory,
  interviewChoiceToolName,
  interviewCopy,
  interviewSignal,
  interviewToolName,
  normalizeMemory,
  parseChoiceResult,
  parseInterviewResult,
  type InterviewChoiceKey,
  type InterviewMemory,
} from '../../../../packages/shared/src/interview';
import { questionIn, type Question } from '../../../../packages/shared/src/templates';
import type { Spec, Technology } from '../../../../packages/shared/src/schema';

/**
 * Build with AI: the specification as a conversation. A guided interview asks one question at a time
 * as an interactive card (chips, yes/no, slider, grid, text, table), instantly and without a model;
 * the AI answers when the person types, or when a card's "Suggest with AI" is chosen. The document
 * grows beside the conversation. The person's own answers are saved directly; anything the AI
 * suggests is a proposal that waits for review.
 */
type Integration = {
  id: string;
  label: string;
  model: string;
  local: boolean;
  configured: boolean;
};
type ModelChoice = { provider: string; model: string };
type Go = (view: string, target?: { sectionId?: string; questionId?: string }) => void;
const agentId = 'builder';

function useModelChoice(projectId: string, localOnly: boolean, enabled: boolean) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [choice, setChoice] = useLocalStorage<ModelChoice | null>(
    `sdd-builder-model-${projectId}`,
    null,
  );
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false);
  const [modelsFor, setModelsFor] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api<Integration[]>('/integrations')
      .then(setIntegrations, () => {})
      .finally(() => setIntegrationsLoaded(true));
  }, [enabled]);
  const usable = enabled
    ? integrations.filter((i) => i.configured && i.id !== 'claude-agent' && (!localOnly || i.local))
    : [];
  const provider =
    choice && usable.some((i) => i.id === choice.provider)
      ? choice.provider
      : (usable.find((i) => i.model) ?? usable[0])?.id;
  useEffect(() => {
    if (!provider) return;
    setModelsFor(null);
    // Embedding models cannot hold a conversation.
    api<{ models: string[] }>(`/integrations/${provider}/models`)
      .then(
        (r) => setModels(r.models.filter((m) => !/embed|bge-|minilm|e5-/i.test(m))),
        () => setModels([]),
      )
      .finally(() => setModelsFor(provider));
  }, [provider]);
  const fallback = usable.find((i) => i.id === provider)?.model;
  const model =
    choice && choice.provider === provider && models.includes(choice.model)
      ? choice.model
      : fallback && models.includes(fallback)
        ? fallback
        : models[0];
  // Known whether an AI is available (or not), so the first thing the assistant says is right about it.
  const settled = !enabled || (integrationsLoaded && (!provider || modelsFor === provider));
  return { usable, provider, model, models, setChoice, settled };
}

/** What the interview remembers (skipped questions, optional pass, …), kept per project in this browser. */
const memoryKey = (projectId: string) => `sdd-interview-${projectId}`;
function useInterviewMemory(projectId: string, epoch: number) {
  return useMemo(() => {
    void epoch;
    let value: InterviewMemory = emptyMemory();
    try {
      const raw = epoch === 0 ? localStorage.getItem(memoryKey(projectId)) : null;
      if (raw) value = normalizeMemory(JSON.parse(raw));
    } catch {
      // Unreadable or blocked storage: the interview starts fresh.
    }
    return {
      get: () => value,
      set: (next: InterviewMemory) => {
        value = next;
        try {
          localStorage.setItem(memoryKey(projectId), JSON.stringify(next));
        } catch {
          // Storage full or blocked: the interview still works, it just forgets after a reload.
        }
      },
    };
  }, [projectId, epoch]);
}

/** Tool cards and conversation, inside the CopilotKit provider. */
function Conversation({
  project,
  catalog,
  focus,
  go,
  notify,
  aiAvailable,
  specRef,
}: {
  project: ProjectState;
  catalog: Technology[];
  focus: string | null;
  go: Go;
  notify: (m: string) => void;
  aiAvailable: boolean;
  specRef: MutableRefObject<Spec>;
}) {
  const l = useL();
  const lang = useLang();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [decided, setDecided] = useState<Record<string, ChatProposal['status']>>({});
  const reloaded = useRef(new Set<string>());
  // Proposals may be decided elsewhere (Proposals page, another reviewer) or before a reload.
  useEffect(() => {
    api<{ id: string; status: ChatProposal['status'] }[]>(`/projects/${spec.id}/proposals`).then(
      (list) =>
        setDecided((d) => ({
          ...d,
          ...Object.fromEntries(
            list.filter((p) => p.status !== 'pending').map((p) => [p.id, p.status]),
          ),
        })),
      () => {},
    );
  }, [spec.id, spec.revision, project.pendingProposals]);

  useAgentContext({ description: 'Focused section', value: focus ?? 'none' });

  // The guided interview: one question at a time, saved as the person's own answer.
  const saveAnswer = async (
    question: Question,
    save: { state: 'answered' | 'unknown' | 'not-applicable'; value: string; reason: string },
  ) => {
    const saved = await project.save(
      { sections: [{ id: question.id.split('.')[0], answers: { [question.id]: save } }] },
      question.label[lang],
    );
    // The next turn of the interview reads the specification through this ref, before React re-renders.
    if (saved) specRef.current = saved;
    return !!saved;
  };
  useHumanInTheLoop(
    {
      name: interviewToolName,
      description: 'Ask the next question of the guided interview.',
      parameters: z.object({ questionId: z.string() }),
      render: ({ args, respond, result }: any) => (
        <QuestionCard
          question={args.questionId ? questionIn(spec, args.questionId) : undefined}
          spec={spec}
          editable={editable}
          aiAvailable={aiAvailable}
          result={
            respond
              ? null
              : (parseInterviewResult(result) ?? {
                  action: 'skipped',
                  questionId: args.questionId ?? '',
                })
          }
          onSave={(save) => saveAnswer(questionIn(spec, args.questionId)!, save)}
          onRespond={(r) => respond?.(JSON.stringify(r))}
          onOpenEditor={() =>
            go('specification', {
              sectionId: String(args.questionId ?? '').split('.')[0],
              questionId: args.questionId,
            })
          }
        />
      ),
    },
    [spec, editable, aiAvailable],
  );
  useHumanInTheLoop({
    name: interviewChoiceToolName,
    description: 'Offer the next step of the guided interview.',
    parameters: z.object({ options: z.array(z.object({ key: z.string(), label: z.string() })) }),
    render: ({ args, respond, result }: any) => (
      <InterviewChoiceCard
        options={(args.options ?? []) as { key: InterviewChoiceKey; label: string }[]}
        result={respond ? null : (parseChoiceResult(result) ?? { key: 'stay' })}
        onPick={(key, label) => {
          if (key === 'open-readiness') go('readiness');
          respond?.(JSON.stringify({ key, label }));
        }}
      />
    ),
  });

  // Cards the AI can show when it takes part in the conversation.
  const tools = builderFrontendTools;
  useHumanInTheLoop({
    name: 'ask_choice',
    ...tools.ask_choice,
    render: ({ args, respond, result }: any) => (
      <ChoiceCard
        question={args.question ?? ''}
        options={args.options ?? []}
        multiple={args.multiple}
        answered={respond ? undefined : (result ?? ' ')}
        onAnswer={(a) => respond?.(a)}
      />
    ),
  });
  useHumanInTheLoop({
    name: 'ask_scale',
    ...tools.ask_scale,
    render: ({ args, respond, result }: any) => (
      <ScaleCard
        question={args.question ?? ''}
        min={args.min ?? 0}
        max={args.max ?? 100}
        step={args.step}
        unit={args.unit}
        suggestion={args.suggestion}
        answered={respond ? undefined : (result ?? ' ')}
        onAnswer={(a) => respond?.(a)}
      />
    ),
  });
  useHumanInTheLoop({
    name: 'ask_text',
    ...tools.ask_text,
    render: ({ args, respond, result }: any) => (
      <TextCard
        question={args.question ?? ''}
        placeholder={args.placeholder}
        answered={respond ? undefined : (result ?? ' ')}
        onAnswer={(a) => respond?.(a)}
      />
    ),
  });
  useHumanInTheLoop({
    name: 'pick_technologies',
    ...tools.pick_technologies,
    render: ({ args, respond, result }: any) => (
      <StackPickCard
        question={args.question ?? ''}
        suggestions={args.suggestions}
        catalog={catalog}
        current={spec.stack}
        lang={lang}
        editable={editable}
        answered={respond ? undefined : (result ?? ' ')}
        onSave={async (entries, names) => {
          // Choosing technologies is the user's own edit, saved like the Stack page does.
          const saved = await project.save(
            (s) => ({
              stack: [
                ...s.stack,
                ...entries.filter(
                  (e) =>
                    !s.stack.some((x) => x.technologyId === e.technologyId && x.layer === e.layer),
                ),
              ],
            }),
            l('Stack', 'Pile'),
          );
          if (saved)
            respond?.(
              l(
                `Added to the stack: ${names.join(', ')}`,
                `Ajouté à la pile : ${names.join(', ')}`,
              ),
            );
        }}
      />
    ),
  });
  useVisualAnswers(agentId, editable);
  useRenderTool(
    {
      name: 'propose_changes',
      parameters: z.object({ title: z.string().optional() }).passthrough(),
      render: ({ status, result }: any) => {
        if (status !== 'complete')
          return (
            <ProposalCard
              running
              canReview={false}
              onAccept={async () => {}}
              onReject={async () => {}}
              onOpen={() => {}}
            />
          );
        let parsed: any = {};
        try {
          parsed = JSON.parse(result ?? '{}');
        } catch {
          parsed = { error: String(result) };
        }
        if (parsed.error)
          return (
            <ProposalCard
              error={parsed.error}
              canReview={false}
              onAccept={async () => {}}
              onReject={async () => {}}
              onOpen={() => {}}
            />
          );
        const id: string = parsed.proposalId;
        if (!reloaded.current.has(id)) {
          reloaded.current.add(id);
          queueMicrotask(() => project.reload());
        }
        return (
          <ProposalCard
            proposal={{ ...parsed, status: decided[id] ?? 'pending' }}
            canReview={can(project.role, 'review')}
            onAccept={async () => {
              project.accept(await api(`/projects/${spec.id}/proposals/${id}/accept`, 'POST'));
              setDecided((d) => ({ ...d, [id]: 'accepted' }));
              // Refreshes readiness and the pending-proposal count in the navigation.
              await project.reload();
              notify(
                l(
                  'Proposal accepted. The document is updated.',
                  'Proposition acceptée. Le document est à jour.',
                ),
              );
            }}
            onReject={async () => {
              await api(`/projects/${spec.id}/proposals/${id}/reject`, 'POST', {});
              setDecided((d) => ({ ...d, [id]: 'rejected' }));
              await project.reload();
            }}
            onOpen={() => go('proposals')}
          />
        );
      },
    },
    [decided, spec.id, project.role],
  );

  const labels = useMemo(
    () => ({
      chatInputPlaceholder: aiAvailable
        ? l(
            'Ask a question…',
            'Posez une question…',
          )
        : l(
            'Next question…',
            'Question suivante…',
          ),
      welcomeMessageText: l('Getting your questions ready…', 'Préparation de vos questions…'),
      chatDisclaimerText: aiAvailable
        ? l(
            'AI suggestions require your review.',
            'Les suggestions de l’IA attendent votre accord.',
          )
        : l(
            'Answers saved automatically.',
            'Réponses enregistrées automatiquement.',
          ),
      assistantMessageToolbarCopyMessageLabel: l('Copy', 'Copier'),
      userMessageToolbarCopyMessageLabel: l('Copy', 'Copier'),
      userMessageToolbarEditMessageLabel: l('Edit', 'Modifier'),
      assistantMessageToolbarRegenerateLabel: l('Regenerate', 'Régénérer'),
      assistantMessageToolbarThumbsUpLabel: l('Helpful', 'Utile'),
      assistantMessageToolbarThumbsDownLabel: l('Not helpful', 'Pas utile'),
    }),
    [l, aiAvailable],
  );
  const box = useRef<HTMLDivElement>(null);
  useIconButtonNames(box, {
    'copilot-send-button': l('Send message', 'Envoyer le message'),
    'copilot-copy-button': l('Copy', 'Copier'),
    'copilot-user-copy-button': l('Copy', 'Copier'),
    'copilot-edit-button': l('Edit message', 'Modifier le message'),
    'copilot-regenerate-button': l('Regenerate', 'Régénérer'),
    'copilot-thumbs-up-button': l('Helpful', 'Utile'),
    'copilot-thumbs-down-button': l('Not helpful', 'Pas utile'),
    'copilot-read-aloud-button': l('Read aloud', 'Lire à voix haute'),
    'copilot-scroll-to-bottom': l('Scroll to the latest message', 'Aller au dernier message'),
  });
  return (
    <div ref={box} className="builder-chat-box">
      <CopilotChat agentId={agentId} labels={labels} className="builder-chat" />
    </div>
  );
}

/** CopilotKit's icon-only buttons (send, message actions, scroll) have tooltips but no accessible name; name them by test id. */
function useIconButtonNames(
  box: React.RefObject<HTMLDivElement | null>,
  names: Record<string, string>,
) {
  const latest = useLatest(names);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const apply = () => {
      for (const [testId, name] of Object.entries(latest.current))
        root.querySelectorAll(`[data-testid="${testId}"]`).forEach((el) => {
          if (el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
        });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [box, latest]);
}

/** Steers the interview from elsewhere on the page: the document's “Answer in chat”, and “Next question”. */
function useInterviewControls() {
  const { agent } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  return useMemo(() => {
    const signal = (content: string) => {
      if (agent.isRunning) agent.abortRun();
      agent.addMessage({ id: crypto.randomUUID(), role: 'developer', content });
      void copilotkit.runAgent({ agent });
    };
    return {
      jump: (questionId: string) => signal(`${interviewSignal.jump}${questionId}`),
      next: () => signal(interviewSignal.next),
    };
  }, [agent, copilotkit]);
}

function Workbench({
  project,
  go,
  notify,
  focus,
  setFocus,
  aiAvailable,
  specRef,
  embedded,
}: {
  project: ProjectState;
  go: Go;
  notify: (m: string) => void;
  focus: string | null;
  setFocus: (id: string | null) => void;
  aiAvailable: boolean;
  specRef: MutableRefObject<Spec>;
  embedded?: boolean;
}) {
  const l = useL();
  const lang = useLang();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [catalog, setCatalog] = useState<Technology[]>([]);
  useEffect(() => {
    api<Technology[]>('/catalog').then(setCatalog, () => {});
  }, []);
  const { jump, next } = useInterviewControls();
  return (
    <div className={`builder-grid${embedded ? ' builder-grid-embedded' : ''}`}>
      <section className="builder-conversation" aria-label={l('Conversation', 'Conversation')}>
        <div className="builder-toolbar">
          <Button
            size="sm"
            variant="ghost"
            disabled={!editable}
            onClick={next}
            title={l(
              'Set the open question aside and ask the next one',
              'Mettre la question ouverte de côté et poser la suivante',
            )}
          >
            <SkipForward size={14} aria-hidden /> {interviewCopy(lang).next}
          </Button>
        </div>
        <Conversation
          project={project}
          catalog={catalog}
          focus={focus}
          go={go}
          notify={notify}
          aiAvailable={aiAvailable}
          specRef={specRef}
        />
      </section>
      {!embedded && (
        <section className="builder-document" aria-label={l('Document', 'Document')}>
          <LiveDocument
            spec={spec}
            editable={editable}
            focus={focus}
            onFocus={setFocus}
            onSave={(patch, label) => project.save(patch, label)}
            onOpen={(sectionId, questionId) => go('specification', { sectionId, questionId })}
            onAnswer={(question, sectionId) => {
              setFocus(sectionId);
              jump(question.id);
            }}
          />
        </section>
      )}
    </div>
  );
}

type Warmth = 'idle' | 'warming' | 'ready' | 'failed';
/** Loads a local model as soon as it is chosen, so the first reply does not wait for it. */
function useWarmModel(
  projectId: string,
  provider: string | undefined,
  model: string | undefined,
  editable: boolean,
) {
  const [state, setState] = useState<{ warmth: Warmth; message?: string }>({ warmth: 'idle' });
  useEffect(() => {
    if (provider !== 'ollama' || !model || !editable) return setState({ warmth: 'idle' });
    let live = true;
    setState({ warmth: 'warming' });
    api(`/projects/${projectId}/agent/warm`, 'POST', { model }).then(
      () => live && setState({ warmth: 'ready' }),
      (e) => live && setState({ warmth: 'failed', message: (e as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [projectId, provider, model, editable]);
  return state;
}


/** The app theme (html[data-theme]); CopilotKit styles its dark mode through a `dark` class. */
function useDarkTheme() {
  const read = () => document.documentElement.dataset.theme === 'dark';
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export default function Builder({
  project,
  go,
  notify,
  embedded = false,
  entry,
  onSectionChange,
  onEntryHandled,
}: {
  project: ProjectState;
  go: Go;
  notify: (m: string) => void;
  embedded?: boolean;
  entry?: ConversationEntry;
  onSectionChange?: (id: string) => void;
  onEntryHandled?: () => void;
}) {
  const l = useL();
  const lang = useLang();
  const reduce = useReducedMotion();
  const spec = project.spec!;
  const aiEnabled = useFeatures().on('ai');
  const editable = can(project.role, 'edit');
  const { usable, provider, model, models, setChoice, settled } = useModelChoice(
    spec.id,
    spec.localOnly,
    aiEnabled && editable,
  );
  // Start after the models are known, but never keep the person waiting more than a moment.
  const [patient, setPatient] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPatient(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  const [threadEpoch, setThreadEpoch] = useState(0);
  const [focus, setFocus] = useLocalStorage<string | null>(`sdd-builder-focus-${spec.id}`, null);
  const specRef = useRef<Spec>(spec);
  const langRef = useLatest(lang);
  const focusRef = useLatest((id: string) => {
    setFocus(id);
    onSectionChange?.(id);
  });
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  const memory = useInterviewMemory(spec.id, threadEpoch);
  const llm = useMemo(
    () =>
      aiEnabled && editable && provider && model
        ? new HttpAgent({
            url: `/api/v1/projects/${spec.id}/agent?${new URLSearchParams({ provider, model })}`,
          })
        : null,
    [spec.id, provider, model, aiEnabled, editable],
  );
  const llmRef = useLatest(llm);
  const reduceRef = useLatest(reduce);
  // The agent stays the same while models load or change (it looks the AI up at each run); a new
  // conversation needs a fresh one, because CopilotKit keeps the messages of the agent it was given.
  const agent = useMemo(() => {
    void threadEpoch;
    return new SpecAgent({
      getSpec: () => specRef.current,
      getLang: () => langRef.current,
      memory,
      llm: () => llmRef.current,
      pace: () => (reduceRef.current ? 0 : 1),
      onSection: (id) => focusRef.current(id),
    });
  }, [memory, threadEpoch, langRef, focusRef, llmRef, reduceRef]);
  const warm = useWarmModel(spec.id, provider, model, editable && aiEnabled);
  const completeness = project.readiness?.percent ?? 0;
  const dark = useDarkTheme();
  return (
    <div className={`${embedded ? 'builder-embedded' : 'view-body'} builder${dark ? ' dark' : ''}`}>
      <motion.header
        className="builder-bar"
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {!embedded && (
          <span className="builder-orb" aria-hidden>
            <Sparkles size={16} />
          </span>
        )}
        {!embedded && (
          <div className="builder-bar-title">
            <strong>{l('Build the document together', 'Construire le document ensemble')}</strong>
            <small className="muted">
              {l(
                `${completeness}% of required answers`,
                `${completeness} % des réponses obligatoires`,
              )}
            </small>
          </div>
        )}
        {provider && aiEnabled ? (
          <label className="builder-model">
            {provider === 'ollama' ? <Cpu size={14} aria-hidden /> : <Bot size={14} aria-hidden />}
            <span className="sr-only">{l('Model', 'Modèle')}</span>
            <select
              value={`${provider}::${model ?? ''}`}
              onChange={(e) => {
                const [p, m] = e.target.value.split('::');
                setChoice({ provider: p, model: m });
              }}
            >
              {usable.map((i) =>
                i.id === provider ? (
                  models.map((m) => (
                    <option key={`${i.id}::${m}`} value={`${i.id}::${m}`}>
                      {i.label} · {m}
                    </option>
                  ))
                ) : (
                  <option key={i.id} value={`${i.id}::`}>
                    {i.label}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : (
          <Badge
            title={
              spec.localOnly
                ? l(
                    'This project is local only: start Ollama and pull a chat model to add the AI.',
                    'Ce projet est local : démarrez Ollama et téléchargez un modèle pour ajouter l’IA.',
                  )
                : l(
                    'Configure an AI provider in Settings > Administration to add the AI.',
                    'Configurez un fournisseur d’IA dans Paramètres > Administration pour ajouter l’IA.',
                  )
            }
          >
            {l('Guided questions only', 'Questions guidées seulement')}
          </Badge>
        )}
        {provider === 'ollama' && aiEnabled && !embedded && (
          <span className="builder-warmth" role="status">
            {warm.warmth === 'warming' ? (
              <Badge tone="blue">
                <Loader2 size={12} className="spin" aria-hidden />{' '}
                {l('Waking up the local model…', 'Réveil du modèle local…')}
              </Badge>
            ) : warm.warmth === 'failed' ? (
              <Badge tone="red" title={warm.message}>
                {l('Local model unavailable', 'Modèle local indisponible')}
              </Badge>
            ) : (
              <Badge tone="green">{l('Runs on your machine', 'S’exécute sur votre machine')}</Badge>
            )}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          title={l('New conversation', 'Nouvelle conversation')}
          aria-label={l('New conversation', 'Nouvelle conversation')}
          onClick={() => {
            storeThread(spec.id, []);
            try {
              localStorage.removeItem(memoryKey(spec.id));
            } catch {
              // Nothing to clear.
            }
            setThreadEpoch((n) => n + 1);
          }}
        >
          <RotateCcw size={14} aria-hidden />{' '}
          {!embedded && l('New conversation', 'Nouvelle conversation')}
        </Button>
      </motion.header>
      <CopilotKit
        key={threadEpoch}
        selfManagedAgents={{ [agentId]: agent }}
        agentId={agentId}
        enableInspector={false}
        showDevConsole={false}
      >
        <Workbench
          project={project}
          go={go}
          notify={notify}
          focus={entry?.sectionId ?? entry?.questionId?.split('.')[0] ?? focus}
          setFocus={setFocus}
          aiAvailable={!!llm && editable}
          specRef={specRef}
          embedded={embedded}
        />
        <ThreadStarter
          projectId={spec.id}
          editable={editable}
          ready={settled || patient}
          entry={entry}
          onEntryHandled={() => {
            const section = entry?.sectionId ?? entry?.questionId?.split('.')[0];
            if (section) focusRef.current(section);
            onEntryHandled?.();
          }}
        />
      </CopilotKit>
    </div>
  );
}
