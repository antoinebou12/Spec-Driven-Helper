import { describe, expect, it } from 'vitest';
import { emptyUseCase, parseUseCase, reviewUseCase, renderUseCase } from '../packages/shared/src/use-case';

const complete = {
  actor: 'Customer',
  trigger: 'Needs help with an order',
  preconditions: ['Signed in'],
  steps: ['Opens a new request', 'Chooses a category', 'Submits the request'],
  alternates: ['Attachment larger than 10 MB: the limit is explained'],
  postconditions: ['The request has an ID'],
};

describe('structured use cases', () => {
  it('writes readable Markdown with a numbered main flow', () => {
    const md = renderUseCase(complete);
    expect(md).toContain('**Actor:** Customer');
    expect(md).toContain('### Main flow\n\n1. Opens a new request\n2. Chooses a category\n3. Submits the request');
    expect(md).toContain('### Alternate flows and edge cases\n\n- Attachment larger than 10 MB');
    expect(renderUseCase({ ...complete, steps: ['  ', 'Only step'] })).toContain('1. Only step');
  });

  it('round-trips in English and French', () => {
    expect(parseUseCase(renderUseCase(complete))).toEqual(complete);
    expect(parseUseCase(renderUseCase(complete, 'fr'))).toEqual(complete);
    expect(renderUseCase(complete, 'fr')).toContain('### Scénario principal');
  });

  it('treats free text as free text', () => {
    expect(parseUseCase('The customer asks for help.')).toBeNull();
    expect(parseUseCase('')).toBeNull();
  });

  it('gives review hints until the use case is complete', () => {
    expect(reviewUseCase(emptyUseCase())).toHaveLength(5);
    expect(reviewUseCase(complete)).toEqual([]);
    expect(reviewUseCase({ ...complete, steps: Array.from({ length: 13 }, (_, i) => `Step ${i}`) })).toEqual(['More than 12 steps: consider splitting the use case.']);
    expect(reviewUseCase(emptyUseCase(), 'fr')[0]).toMatch(/acteur/);
  });
});
