import { useEffect, useRef, useState } from 'react';
import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';
import { useLatest } from './hooks';
import { interviewToolName, interviewChoiceToolName, interviewSignal } from '../../../packages/shared/src/interview';

export type ConversationEntry = { id: string; sectionId?: string; questionId?: string; prompt?: string };
const agentId = 'builder';

/** The conversation, kept per project in this browser so a reload does not lose it. */
const threadKey = (projectId: string) => `sdd-builder-thread-${projectId}`;
const frontendCards = new Set<string>([
  interviewToolName,
  interviewChoiceToolName,
  'ask_choice',
  'ask_scale',
  'ask_text',
  'pick_technologies',
]);
/** A kept conversation as it can be resumed: cards nobody answered are gone with their page, and no orphan results remain. */
function resumable(messages: any[]): any[] {
  const answered = new Set(messages.filter((m) => m.role === 'tool').map((m) => m.toolCallId));
  const out = [...messages];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role === 'developer' && String(m.content).startsWith('interview:')) {
      out.splice(i, 1);
      continue;
    }
    if (m.role !== 'assistant') break;
    if (
      (m.toolCalls ?? []).some(
        (c: any) => frontendCards.has(c.function?.name) && !answered.has(c.id),
      )
    )
      out.splice(i, 1);
    else break;
  }
  while (out[0]?.role === 'tool') out.shift();
  return out;
}
function storedThread(projectId: string) {
  try {
    const raw = localStorage.getItem(threadKey(projectId));
    const messages = raw ? JSON.parse(raw) : [];
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}
export function storeThread(projectId: string, messages: readonly unknown[]) {
  try {
    localStorage.setItem(threadKey(projectId), JSON.stringify(messages.slice(-80)));
  } catch {
    // Storage full or blocked: the conversation still works, it is just not kept.
  }
}

/**
 * Restores the kept conversation into the agent, keeps it up to date, and gets the interview going.
 * It must come after the chat in the tree: CopilotChat empties the agent's messages when it first
 * mounts, and this effect has to run after that to be the one that sticks.
 */
export function ThreadStarter({
  projectId,
  editable,
  ready,
  entry,
  onEntryHandled,
}: {
  projectId: string;
  editable: boolean;
  ready: boolean;
  entry?: ConversationEntry;
  onEntryHandled: () => void;
}) {
  const { agent, isReady } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const started = useRef(false);
  const handled = useRef<string | undefined>(undefined);
  const [finished, setFinished] = useState(0);
  const entryHandled = useLatest(onEntryHandled);
  useEffect(() => {
    // Until CopilotKit has connected, `agent` is a stand-in that is swapped for ours.
    if (!isReady || !ready) return;
    if (!started.current) {
      started.current = true;
      if (!agent.messages.length) {
        const stored = resumable(storedThread(projectId));
        if (stored.length) agent.setMessages(stored);
      }
      if (editable && !entry && !agent.isRunning) {
        agent.addMessage({
          id: crypto.randomUUID(),
          role: 'developer',
          content: interviewSignal.start,
        });
        void copilotkit.runAgent({ agent });
      }
    }
    // A contextual request is consumed once, after the current turn finishes.
    if (editable && entry && handled.current !== entry.id && !agent.isRunning) {
      handled.current = entry.id;
      const suggestion = entry.prompt && entry.questionId;
      agent.addMessage({
        id: crypto.randomUUID(),
        role: entry.prompt && !suggestion ? 'user' : 'developer',
        content: suggestion
          ? `${interviewSignal.suggest}${entry.questionId}`
          : (entry.prompt ?? `${interviewSignal.jump}${entry.questionId}`),
      });
      void copilotkit.runAgent({ agent });
      entryHandled.current();
    }
    const subscription = agent.subscribe({
      onMessagesChanged: ({ messages }) => storeThread(projectId, messages),
      onRunFinalized: () => {
        setFinished((n) => n + 1);
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, isReady, finished, ready, copilotkit, projectId, editable, entry, entryHandled]);
  return null;
}
