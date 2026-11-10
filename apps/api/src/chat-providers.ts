import { credential, isOpenaiCompatible, openaiHost, ProviderError, type OpenaiCompatible, type ProviderName, type Usage } from './providers';
import { ollamaModelInfo, ollamaUrl } from './ollama';

/**
 * Streaming, tool-calling chat for the conversational builder. One turn: the model streams text
 * through `onText` and may return tool calls. Provider differences (OpenAI and Ollama messages,
 * Anthropic content blocks, NDJSON or SSE streams) stay inside this module.
 */
export type ChatToolCall = { id: string; name: string; arguments: string };
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ChatToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string; toolName?: string };
export type ChatTool = { name: string; description: string; parameters: unknown };
export type ChatTurn = { text: string; toolCalls: ChatToolCall[]; usage: Usage; truncated?: boolean };

async function open(url: string, init: RequestInit, label: string) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if ((error as Error).name === 'AbortError' || init.signal?.aborted) throw error;
    throw new ProviderError(label === 'Ollama' ? `Ollama is not reachable at ${ollamaUrl()}. Start it with “ollama serve”.` : `${label} is unavailable`, true);
  }
  if (!response.ok || !response.body) {
    // Only the local server's reason is shown; cloud error bodies can echo credential fragments.
    const reason = label === 'Ollama' ? String(((await response.json().catch(() => ({}))) as any).error ?? '').slice(0, 300) : '';
    throw new ProviderError(`${label} request failed (${response.status})${reason ? `: ${reason}` : ''}`, response.status === 429 || response.status >= 500);
  }
  return response.body;
}

/** Yields complete lines from a byte stream (NDJSON and server-sent events). */
async function* lines(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line) yield line;
    }
  }
  if (buffer.trim()) yield buffer.trim();
}
const sseData = async function* (body: ReadableStream<Uint8Array>) {
  for await (const line of lines(body)) if (line.startsWith('data:')) yield line.slice(5).trim();
};
const parseArgs = (text: string) => {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
};

/** Whether a local model can call tools; models without it use the fenced-proposal fallback. */
export async function ollamaSupportsTools(model: string) {
  const info = await ollamaModelInfo(model);
  return info.capabilities.includes('tools');
}

async function ollamaTurn(model: string, messages: ChatMessage[], tools: ChatTool[], onText: (d: string) => void, signal: AbortSignal, window: number): Promise<ChatTurn> {
  const body = await open(
    `${ollamaUrl()}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: true,
        // Keep the model loaded between turns so a conversation feels immediate.
        keep_alive: '30m',
        options: { num_ctx: window, temperature: 0.4 },
        ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: t })) } : {}),
        messages: messages.map((m) =>
          m.role === 'assistant'
            ? { role: 'assistant', content: m.content, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: parseArgs(c.arguments) } })) } : {}) }
            : m.role === 'tool'
              ? { role: 'tool', content: m.content, ...(m.toolName ? { tool_name: m.toolName } : {}) }
              : m,
        ),
      }),
      signal,
    },
    'Ollama',
  );
  let text = '';
  const toolCalls: ChatToolCall[] = [];
  let usage: Usage = { inputTokens: 0, outputTokens: 0 },
    truncated = false;
  for await (const line of lines(body)) {
    const chunk = JSON.parse(line);
    if (chunk.error) throw new ProviderError(`Ollama: ${String(chunk.error).slice(0, 300)}`);
    const delta = chunk.message?.content ?? '';
    if (delta) {
      text += delta;
      onText(delta);
    }
    for (const call of chunk.message?.tool_calls ?? [])
      toolCalls.push({ id: `call_${crypto.randomUUID()}`, name: String(call.function?.name ?? ''), arguments: JSON.stringify(call.function?.arguments ?? {}) });
    if (chunk.done) {
      usage = { inputTokens: chunk.prompt_eval_count ?? 0, outputTokens: chunk.eval_count ?? 0 };
      truncated = chunk.done_reason === 'length';
    }
  }
  return { text, toolCalls, usage, truncated };
}

/** OpenAI and NVIDIA NIM share this turn; the host, key and token-limit field differ. */
async function openaiTurn(provider: OpenaiCompatible, model: string, messages: ChatMessage[], tools: ChatTool[], onText: (d: string) => void, signal: AbortSignal): Promise<ChatTurn> {
  const host = await openaiHost(provider);
  const body = await open(
    `${host.url}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...host.headers },
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        ...(provider === 'openai' ? { max_completion_tokens: 4000 } : { max_tokens: 4000, temperature: 0.4 }),
        ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: t })) } : {}),
        messages: messages.map((m) =>
          m.role === 'assistant'
            ? { role: 'assistant', content: m.content || null, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) } : {}) }
            : m.role === 'tool'
              ? { role: 'tool', content: m.content, tool_call_id: m.toolCallId }
              : m,
        ),
      }),
      signal,
    },
    host.label,
  ).catch((error) => {
    // Hosted NIM rejects tools for models that cannot call them; say so instead of a bare 400.
    if (provider === 'nvidia-nim' && tools.length && error instanceof ProviderError && /\(400\)/.test(error.message))
      throw new ProviderError(`${error.message}. This model may not support tool calls; choose another NVIDIA NIM model, such as openai/gpt-oss-20b or mistralai/mistral-large-2-instruct.`);
    throw error;
  });
  let text = '';
  const calls: ChatToolCall[] = [];
  let usage: Usage = { inputTokens: 0, outputTokens: 0 },
    truncated = false;
  for await (const data of sseData(body)) {
    if (data === '[DONE]') break;
    const chunk = JSON.parse(data);
    if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 };
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason === 'length') truncated = true;
    if (choice.delta?.content) {
      text += choice.delta.content;
      onText(choice.delta.content);
    }
    for (const d of choice.delta?.tool_calls ?? []) {
      const call = (calls[d.index] ??= { id: d.id ?? `call_${crypto.randomUUID()}`, name: '', arguments: '' });
      if (d.function?.name) call.name += d.function.name;
      if (d.function?.arguments) call.arguments += d.function.arguments;
    }
  }
  return { text, toolCalls: calls.filter(Boolean), usage, truncated };
}

async function anthropicTurn(model: string, messages: ChatMessage[], tools: ChatTool[], onText: (d: string) => void, signal: AbortSignal): Promise<ChatTurn> {
  const key = await credential('anthropic');
  if (!key) throw new ProviderError('Configure an Anthropic API key in Settings');
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  // Anthropic takes tool calls and results as content blocks; consecutive tool results share one user turn.
  const converted: { role: 'user' | 'assistant'; content: any[] }[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const block =
      m.role === 'tool'
        ? { role: 'user' as const, content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }] }
        : m.role === 'assistant'
          ? { role: 'assistant' as const, content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: parseArgs(c.arguments) }))] }
          : { role: 'user' as const, content: [{ type: 'text', text: m.content }] };
    const last = converted.at(-1);
    if (last && last.role === block.role) last.content.push(...block.content);
    else if (block.content.length) converted.push(block);
  }
  const body = await open(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        system,
        stream: true,
        max_tokens: 4000,
        ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
        messages: converted,
      }),
      signal,
    },
    'Anthropic API',
  );
  let text = '';
  const calls: ChatToolCall[] = [];
  const blocks = new Map<number, ChatToolCall>();
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let truncated = false;
  for await (const data of sseData(body)) {
    const event = JSON.parse(data);
    if (event.type === 'message_start') usage.inputTokens = event.message?.usage?.input_tokens ?? 0;
    else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      const call = { id: event.content_block.id, name: event.content_block.name, arguments: '' };
      blocks.set(event.index, call);
      calls.push(call);
    } else if (event.type === 'content_block_delta') {
      if (event.delta?.type === 'text_delta') {
        text += event.delta.text;
        onText(event.delta.text);
      } else if (event.delta?.type === 'input_json_delta') {
        const call = blocks.get(event.index);
        if (call) call.arguments += event.delta.partial_json;
      }
    } else if (event.type === 'message_delta') {
      usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
      if (event.delta?.stop_reason === 'max_tokens') truncated = true;
    } else if (event.type === 'error') throw new ProviderError(`Anthropic API: ${event.error?.type ?? 'error'}`, true);
  }
  return { text, toolCalls: calls, usage, truncated };
}

export async function chatTurn(
  provider: ProviderName,
  model: string,
  messages: ChatMessage[],
  tools: ChatTool[],
  onText: (delta: string) => void,
  signal: AbortSignal,
  options: { ollamaWindow?: number } = {},
): Promise<ChatTurn> {
  if (provider === 'ollama') return ollamaTurn(model, messages, tools, onText, signal, options.ollamaWindow ?? 8192);
  if (isOpenaiCompatible(provider)) return openaiTurn(provider, model, messages, tools, onText, signal);
  if (provider === 'anthropic') return anthropicTurn(model, messages, tools, onText, signal);
  throw new ProviderError('The conversational builder supports Ollama, OpenAI, NVIDIA NIM and Anthropic. Choose one of them for this project.');
}
