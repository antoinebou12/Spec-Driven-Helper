import { decode } from '@toon-format/toon';

/** Bundles travel as canonical JSON or TOON (a compact, lossless JSON notation for language models). */
export type BundleFormat = 'json' | 'toon';
export const bundleLimits = { chars: 20_000_000 } as const;

/** JSON when the text starts with `{`, otherwise TOON; throws a readable error for anything else. */
export function parseBundleText(text: string, format?: BundleFormat): unknown {
  if (text.length > bundleLimits.chars) throw new Error('The bundle is larger than 20 MB');
  const kind = format ?? (/^\s*\{/.test(text) ? 'json' : 'toon');
  try {
    return kind === 'json' ? JSON.parse(text) : decode(text);
  } catch (error) {
    throw new Error(`Not a valid ${kind.toUpperCase()} bundle: ${(error as Error).message.split('\n')[0]}`);
  }
}
