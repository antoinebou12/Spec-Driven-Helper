import { z } from 'zod';

/**
 * Tools of the conversational document builder (AG-UI). Frontend tools are rendered by the browser
 * as interactive cards and answered by the user; the one server tool turns facts into a proposal.
 * The model never writes the specification: every change goes through `propose_changes`.
 */
const questionId = z.string().max(120).optional().describe('Id of the specification question this asks about, from the outline');

export const builderFrontendTools = {
  ask_choice: {
    description: 'Ask the user to pick one option (or several when multiple is true). Prefer this over asking in prose whenever the answer is one of a few options.',
    parameters: z.object({
      question: z.string().min(1).max(300).describe('Short question shown on the card'),
      options: z.array(z.string().min(1).max(120)).min(2).max(8),
      multiple: z.boolean().optional(),
      questionId,
    }),
  },
  ask_scale: {
    description: 'Ask the user for a number on a slider, for targets such as availability, response time, users or budget.',
    parameters: z.object({
      question: z.string().min(1).max(300),
      min: z.number(),
      max: z.number(),
      step: z.number().positive().optional(),
      unit: z.string().max(20).optional(),
      suggestion: z.number().optional(),
      questionId,
    }),
  },
  ask_text: {
    description: 'Ask the user for a short free-text answer when options do not fit.',
    parameters: z.object({
      question: z.string().min(1).max(300),
      placeholder: z.string().max(200).optional(),
      questionId,
    }),
  },
  pick_technologies: {
    description: 'Let the user pick technologies for the stack from the catalog, optionally pre-selecting suggestions.',
    parameters: z.object({
      question: z.string().min(1).max(300),
      suggestions: z.array(z.string().max(80)).max(12).optional().describe('Technology names to pre-select'),
    }),
  },
} as const;
export type BuilderFrontendTool = keyof typeof builderFrontendTools;
export const builderFrontendToolNames = Object.keys(builderFrontendTools) as BuilderFrontendTool[];

export const proposeChangesTool = {
  name: 'propose_changes',
  description:
    'Record facts the user has confirmed as a proposal for review. It is never applied directly. Use exact section and question ids from the outline. Only include what the user said or clearly confirmed.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'One-line summary of the change' },
      patch: {
        type: 'object',
        description:
          'Partial specification patch: {"sections":[{"id":"<sectionId>","answers":{"<questionId>":{"value":"<text>","state":"answered"|"unknown"|"not-applicable","reason":""}}}],"items"?:[{"id":"REQ-001","type":"requirement","title":"","body":"","acceptance":"","status":"draft"}]}',
      },
      assumptions: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'patch'],
  },
} as const;

/** Result the browser renders for a proposal made in the conversation. */
export type ProposeResult = { proposalId: string; title: string; changes: number; status: 'pending' } | { error: string };
