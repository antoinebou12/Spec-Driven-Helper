import Fastify from 'fastify';

/**
 * Deterministic Ollama-compatible provider for browser tests. AI runs (non-streaming) get a small,
 * valid proposal with a generated follow-up control; the Build with AI conversation (streaming)
 * gets a short reply and a `propose_changes` call recording what the user typed. Journeys never
 * depend on a real model.
 */
const app = Fastify();
app.get('/api/tags', async () => ({ models: [{ name: 'fake-model' }] }));
app.post('/api/show', async () => ({ capabilities: ['completion', 'tools'], model_info: { 'llama.context_length': 8192 }, details: { family: 'llama' } }));
app.post('/api/generate', async () => ({ done: true }));

type ChatBody = { stream?: boolean; messages: { role: string; content: string }[] };
app.post('/api/chat', async (req, reply) => {
  const body = req.body as ChatBody;
  if (body.stream) {
    const last = body.messages.at(-1)!;
    // A suggestion asked for by the interview names its question, like "(discovery.2)".
    const suggested = /Suggest a concrete answer[^]*?\(([a-z]+\.\d+)\)/.exec(last.content)?.[1];
    const target = suggested ?? 'discovery.1';
    const value = suggested ? 'Answer every customer request within one business day.' : last.content.slice(0, 500);
    // Asked to compare, it answers with an interactive comparison (show_visual) instead of prose.
    const compare = last.role === 'user' && /^compare\b/i.test(last.content);
    const visual = {
      kind: 'comparison',
      title: 'Database for the request store',
      options: ['PostgreSQL', 'MongoDB'],
      criteria: [
        { name: 'Team knows it', weight: 3 },
        { name: 'Flexible documents', weight: 1 },
      ],
      cells: [
        [{ score: 5, note: 'Used daily' }, { score: 2 }],
        [{ score: 3 }, { score: 5 }],
      ],
      basis: 'Estimate from what you said about the team.',
    };
    const chunks =
      last.role === 'tool'
        ? [{ message: { content: 'Recorded. It is waiting for your review.' } }]
        : compare
          ? [{ message: { content: 'Here is how they compare; change what matters.', tool_calls: [{ function: { name: 'show_visual', arguments: { visual } } }] } }]
          : [
            { message: { content: suggested ? 'Here is a suggestion: ' : 'Thanks, ' } },
            { message: { content: suggested ? 'I will propose it for your review.' : 'I will record that as the problem statement.' } },
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    function: {
                      name: 'propose_changes',
                      arguments: { title: suggested ? 'Suggested answer' : 'Problem statement', patch: { sections: [{ id: target.split('.')[0], answers: { [target]: { value, state: 'answered', reason: '' } } }] } },
                    },
                  },
                ],
              },
            },
          ];
    reply.header('Content-Type', 'application/x-ndjson');
    return [...chunks, { done: true, done_reason: 'stop', prompt_eval_count: 200, eval_count: 30 }].map((c) => JSON.stringify(c)).join('\n');
  }
  return {
    message: {
      content: JSON.stringify({
        title: 'Clarify target users',
        patch: {
          sections: [
            {
              id: 'discovery',
              answers: {
                'discovery.4': {
                  value: 'Office managers at client companies; support agents triaging all day.',
                  state: 'answered',
                  reason: '',
                },
              },
            },
          ],
        },
        assumptions: ['Personas inferred from the recorded problem statement.'],
        sources: [],
        ui: [{ kind: 'choice', questionId: 'quality.3', label: 'Which availability target fits?', options: ['99.5%', '99.9%'] }],
      }),
    },
    prompt_eval_count: 1200,
    eval_count: 180,
  };
});
await app.listen({ host: '127.0.0.1', port: Number(process.env.FAKE_OLLAMA_PORT ?? 11998) });
