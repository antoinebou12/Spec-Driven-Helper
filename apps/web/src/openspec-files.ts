import { openspecLimits, safeOpenSpecPath } from '../../../packages/shared/src/openspec-format';

type ByteStream = {
  on(event: 'data', callback: (chunk: Uint8Array) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'end', callback: () => void): void;
  pause(): void;
  resume(): void;
};

/** Bound decompression while streaming; JSZip's sanitized name cannot detect traversal. */
export async function readOpenSpecSelection(selection: FileList | File[]) {
  const files: Record<string, string> = Object.create(null);
  let total = 0;
  const add = (raw: string, text: string) => {
    const path = safeOpenSpecPath(raw);
    if (!path || files[path] !== undefined) throw new Error('Unsafe or duplicate file path');
    const size = new TextEncoder().encode(text).length;
    total += size;
    if (
      size > openspecLimits.fileBytes ||
      total > openspecLimits.totalBytes ||
      Object.keys(files).length >= openspecLimits.files
    )
      throw new Error('File limit exceeded');
    files[path] = text;
  };
  if (selection.length > openspecLimits.files) throw new Error('Too many files');
  for (const file of Array.from(selection)) {
    if (file.size > openspecLimits.totalBytes) throw new Error('Archive too large');
    if (/\.zip$/i.test(file.name)) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter((e) => !e.dir);
      if (entries.length > openspecLimits.files) throw new Error('Too many archive entries');
      for (const entry of entries) {
        const raw =
          (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ??
          entry.name;
        if (!safeOpenSpecPath(raw)) throw new Error('Unsafe archive path');
        const text = await new Promise<string>((resolve, reject) => {
          // JSZip exposes this documented streaming API but omits it from JSZipObject's types.
          const stream = (
            entry as typeof entry & { internalStream(type: 'uint8array'): ByteStream }
          ).internalStream('uint8array');
          const decoder = new TextDecoder('utf-8', { fatal: true });
          let length = 0,
            content = '';
          stream.on('data', (chunk: Uint8Array) => {
            length += chunk.length;
            if (length > openspecLimits.fileBytes || total + length > openspecLimits.totalBytes) {
              stream.pause();
              reject(new Error('Expanded archive limit exceeded'));
              return;
            }
            try {
              content += decoder.decode(chunk, { stream: true });
            } catch (e) {
              stream.pause();
              reject(e);
            }
          });
          stream.on('error', reject);
          stream.on('end', () => {
            try {
              resolve(content + decoder.decode());
            } catch (e) {
              reject(e);
            }
          });
          stream.resume();
        });
        add(raw, text);
      }
    } else {
      if (file.size > openspecLimits.fileBytes) throw new Error('File too large');
      add(
        file.webkitRelativePath || file.name,
        new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()),
      );
    }
  }
  return files;
}
