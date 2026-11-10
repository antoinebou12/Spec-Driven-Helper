export const ollamaUrl = () =>
  (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

/**
 * Context window requested from Ollama. Its own default is a few thousand tokens and silently
 * drops the start of longer prompts, so runs always ask for an explicit window.
 */
export const ollamaNumCtx = () =>
  Math.min(131_072, Math.max(2_048, Number(process.env.OLLAMA_NUM_CTX) || 8_192));
export const ollamaOutputTokens = () =>
  Math.min(16_384, Math.max(512, Number(process.env.OLLAMA_NUM_PREDICT) || 2_048));

export type OllamaModelInfo = {
  contextLength?: number;
  capabilities: string[];
  family?: string;
  parameterSize?: string;
  quantization?: string;
};

const infoCache = new Map<string, { at: number; info: OllamaModelInfo }>();

async function ollamaJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ollamaUrl()}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Ollama ${path} failed (${response.status})`);
  return response.json() as Promise<any>;
}

/** Model details from `/api/show`; unknown fields stay undefined when the server is older. */
export async function ollamaModelInfo(model: string): Promise<OllamaModelInfo> {
  const cached = infoCache.get(model);
  if (cached && Date.now() - cached.at < 600_000) return cached.info;
  let info: OllamaModelInfo = { capabilities: [] };
  try {
    const data = await ollamaJson('/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const contextKey = Object.keys(data.model_info ?? {}).find((key) =>
      key.endsWith('.context_length'),
    );
    info = {
      contextLength: contextKey ? Number(data.model_info[contextKey]) || undefined : undefined,
      capabilities: Array.isArray(data.capabilities) ? data.capabilities.map(String) : [],
      family: data.details?.family,
      parameterSize: data.details?.parameter_size,
      quantization: data.details?.quantization_level,
    };
  } catch {
    return info;
  }
  infoCache.set(model, { at: Date.now(), info });
  return info;
}

/** The window a run uses: the configured size, capped by what the model supports. */
export async function ollamaContextWindow(model: string) {
  const { contextLength } = await ollamaModelInfo(model);
  return Math.min(ollamaNumCtx(), contextLength ?? Number.POSITIVE_INFINITY);
}

const displayUrl = (raw: string) => {
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    return url.origin;
  } catch {
    return raw;
  }
};

const sameModel = (name: string, wanted: string) =>
  name === wanted || name === `${wanted}:latest` || `${name}:latest` === wanted;

/** Connection check for administrators: version, installed models with their limits, loaded models. */
export async function ollamaStatus(expected: { chatModel?: string; embeddingModel?: string } = {}) {
  const url = displayUrl(ollamaUrl());
  try {
    const [version, tags, running] = await Promise.all([
      ollamaJson('/api/version'),
      ollamaJson('/api/tags'),
      ollamaJson('/api/ps').catch(() => ({ models: [] })),
    ]);
    const loaded = new Set<string>((running.models ?? []).map((m: any) => String(m.name)));
    const models = await Promise.all(
      (tags.models ?? []).map(async (m: any) => {
        const name = String(m.name);
        const info = await ollamaModelInfo(name);
        return {
          name,
          size: Number(m.size) || 0,
          loaded: loaded.has(name),
          ...info,
          family: info.family ?? m.details?.family,
          parameterSize: info.parameterSize ?? m.details?.parameter_size,
        };
      }),
    );
    models.sort((a, b) => a.name.localeCompare(b.name));
    const has = (wanted?: string) =>
      wanted ? models.some((m) => sameModel(m.name, wanted)) : undefined;
    return {
      reachable: true as const,
      url,
      version: String(version.version ?? ''),
      numCtx: ollamaNumCtx(),
      models,
      chatModel: expected.chatModel
        ? { name: expected.chatModel, installed: has(expected.chatModel) }
        : undefined,
      embeddingModel: expected.embeddingModel
        ? { name: expected.embeddingModel, installed: has(expected.embeddingModel) }
        : undefined,
    };
  } catch (error) {
    return {
      reachable: false as const,
      url,
      numCtx: ollamaNumCtx(),
      error:
        (error as Error).name === 'TimeoutError'
          ? 'Ollama did not answer within 10 seconds'
          : 'Ollama is unreachable',
    };
  }
}

export function clearOllamaCache() {
  infoCache.clear();
}
