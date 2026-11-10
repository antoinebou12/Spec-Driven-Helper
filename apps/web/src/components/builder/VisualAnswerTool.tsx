import { useCallback } from 'react';
import { z } from 'zod';
import { useAgent, useCopilotKit, useRenderTool } from '@copilotkit/react-core/v2';
import { showVisualTool } from '../../../../../packages/shared/src/visual-answers';
import { VisualAnswerCard } from './VisualAnswer';

/**
 * Registers how the conversation draws `show_visual` (answers you can interact with). A follow-up the
 * person clicks on one is sent as their own message, so whatever the AI records next is a proposal.
 */
export function useVisualAnswers(agentId: string, editable: boolean) {
  const { agent } = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const say = useCallback(
    (content: string) => {
      if (agent.isRunning) agent.abortRun();
      agent.addMessage({ id: crypto.randomUUID(), role: 'user', content });
      void copilotkit.runAgent({ agent });
    },
    [agent, copilotkit],
  );
  useRenderTool(
    {
      name: showVisualTool.name,
      parameters: z.object({ visual: z.unknown() }).passthrough(),
      // A render tool gets the call's arguments as `parameters` (partial while they stream in).
      render: ({ parameters, status }) => (
        <VisualAnswerCard
          args={parameters}
          running={status !== 'complete'}
          onFollowUp={editable ? say : undefined}
        />
      ),
    },
    [editable, say],
  );
}
