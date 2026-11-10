import { expect, it } from 'vitest';
import JSZip from 'jszip';
import { readOpenSpecSelection } from '../apps/web/src/openspec-files';
import { openspecLimits } from '../packages/shared/src/openspec-format';

async function archive(files: Record<string, string | Uint8Array>) {
  const zip = new JSZip();
  for (const [path, text] of Object.entries(files)) zip.file(path, text);
  return new File(
    [await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })],
    'exchange.zip',
  );
}

it('reads bilingual ZIP and folder content without changing source text', async () => {
  const text = '# Spécification\n\nÉquipe / Team';
  const file = new File([text], 'spec.md');
  Object.defineProperty(file, 'webkitRelativePath', {
    value: 'bundle/openspec/specs/scope/spec.md',
  });
  const expected = { 'openspec/specs/scope/spec.md': text };
  expect(await readOpenSpecSelection([file])).toEqual(expected);
  expect(await readOpenSpecSelection([await archive(expected)])).toEqual(expected);
});

it('rejects original traversal paths even when JSZip normalizes them', async () => {
  await expect(
    readOpenSpecSelection([await archive({ '../openspec/specs/scope/spec.md': 'unsafe' })]),
  ).rejects.toThrow('Unsafe');
});

it('rejects secrets, duplicate normalized paths and malformed UTF-8', async () => {
  await expect(
    readOpenSpecSelection([await archive({ 'openspec/.env': 'secret' })]),
  ).rejects.toThrow('Unsafe');
  await expect(
    readOpenSpecSelection([
      await archive({ 'a/openspec/specs/a/spec.md': 'one', 'b/openspec/specs/a/spec.md': 'two' }),
    ]),
  ).rejects.toThrow('duplicate');
  await expect(
    readOpenSpecSelection([
      await archive({ 'openspec/specs/a/spec.md': new Uint8Array([0xc0, 0xaf]) }),
    ]),
  ).rejects.toThrow();
  await expect(
    readOpenSpecSelection([new File([new Uint8Array([0xc0, 0xaf])], 'spec.md')]),
  ).rejects.toThrow();
});

it('bounds archive expansion and file counts', async () => {
  await expect(
    readOpenSpecSelection([
      await archive({ 'openspec/specs/a/spec.md': 'a'.repeat(openspecLimits.fileBytes + 1) }),
    ]),
  ).rejects.toThrow('Expanded archive limit');
  await expect(
    readOpenSpecSelection(Array.from({ length: 401 }, () => new File(['x'], 'spec.md'))),
  ).rejects.toThrow('Too many');
});
