import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import JSZip from 'jszip';
import { PlanImportPreview, readSelection } from './PlanFolder';
import { samplePlanSummary } from '../test/plan-sample';

describe('.plan folder import', () => {
  it('summarises the specification proposal, board changes and skipped files', () => {
    render(<PlanImportPreview summary={samplePlanSummary} />);
    expect(screen.getByText(/42 changes from \.plan\/specification\.json/)).toBeTruthy();
    expect(screen.getByText(/2 new and 1 updated cards from board\.json/)).toBeTruthy();
    expect(screen.getByText('1 files or lines not imported')).toBeTruthy();
  });

  it('reads chosen folders with their relative paths and zips, keeping text files only', async () => {
    const md = new File(['- [ ] T-1 a'], 'tasks.md');
    Object.defineProperty(md, 'webkitRelativePath', { value: 'repo/.plan/tasks.md' });
    const loose = new File(['# b'], 'backlog.md');
    const image = new File([new Uint8Array([1, 2])], 'logo.png');
    const zip = new JSZip();
    zip.file('.plan/board.json', '{}');
    zip.file('.plan/picture.png', 'x');
    const zipFile = new File([(await zip.generateAsync({ type: 'uint8array' })) as Uint8Array<ArrayBuffer>], 'plan.zip');
    // jsdom's File lacks arrayBuffer/text in some versions; provide them from the bytes.
    const withBytes = (f: File, bytes: Uint8Array | string) => Object.assign(f, { arrayBuffer: async () => (typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes).buffer as ArrayBuffer, text: async () => (typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)) });
    const files = await readSelection([
      withBytes(md, '- [ ] T-1 a'),
      withBytes(loose, '# b'),
      withBytes(image, new Uint8Array([1, 2])),
      withBytes(zipFile, await zip.generateAsync({ type: 'uint8array' })),
    ]);
    expect(Object.keys(files).sort()).toEqual(['.plan/backlog.md', '.plan/board.json', 'repo/.plan/tasks.md']);
    expect(files['repo/.plan/tasks.md']).toBe('- [ ] T-1 a');
  });
});
