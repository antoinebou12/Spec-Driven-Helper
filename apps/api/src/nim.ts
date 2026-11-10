/**
 * NVIDIA NIM speaks the OpenAI chat protocol. By default it is the free hosted API Catalog
 * (a key from build.nvidia.com); NIM_BASE_URL points at a self-hosted NIM instead, for example
 * http://nim:8000/v1, which needs no key.
 */
export const nimHostedUrl = 'https://integrate.api.nvidia.com/v1';

/** The configured NIM base URL without a trailing slash. Throws when it cannot be trusted. */
export function nimUrl(): string {
  const configured = process.env.NIM_BASE_URL?.trim();
  if (!configured) return nimHostedUrl;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new TypeError('NIM_BASE_URL must be an http(s) URL such as http://nim:8000/v1');
  }
  if (!/^https?:$/.test(url.protocol))
    throw new TypeError('NIM_BASE_URL must be an http(s) URL such as http://nim:8000/v1');
  // Credentials in a URL end up in logs and error messages; the key belongs in Settings.
  if (url.username || url.password)
    throw new TypeError('NIM_BASE_URL must not contain a user name or password');
  return configured.replace(/\/+$/, '');
}

/** A self-hosted NIM usually needs no key; the hosted catalog always does. An unusable URL counts as hosted. */
export function nimSelfHosted(): boolean {
  try {
    return nimUrl() !== nimHostedUrl;
  } catch {
    return false;
  }
}

/** The catalog also lists embedding, safety, reward, vision and speech models that cannot chat. */
const notChat =
  /embed|rerank|reward|guard|safety|retriev|parse|clip|vila|neva|kosmos|fuyu|deplot|vision|vlm|detector|calibration|riva|diffusion|cosmos/i;
export const isNimChatModel = (id: string) => !notChat.test(id);
