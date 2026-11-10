import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoiceCard, defaultLayer, ProposalCard, ScaleCard, StackPickCard, TextCard } from './BuilderCards';
import { LiveDocument } from './LiveDocument';
import { buildExampleSpec } from '../../../../../packages/shared/src/example';
import { createSpec } from '../../../../../packages/shared/src/domain';
import type { Technology } from '../../../../../packages/shared/src/schema';

const tech = (id: string, name: string, category: string) => ({ id, name, category, tags: [name.toLowerCase()], version: '1', versions: [{ version: '1', lts: true, latest: true, support: '' }] }) as unknown as Technology;

describe('conversation cards', () => {
  it('answers a single choice with one click, and a multiple choice after picking', async () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<ChoiceCard question="Who first?" options={['Agents', 'Customers']} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Customers' }));
    expect(onAnswer).toHaveBeenLastCalledWith('Customers');
    rerender(<ChoiceCard question="Channels?" options={['Email', 'Chat', 'Web']} multiple onAnswer={onAnswer} />);
    const send = screen.getByRole('button', { name: /Send/ });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Email' }));
    await userEvent.click(screen.getByRole('button', { name: 'Web' }));
    expect(screen.getByRole('button', { name: /Email/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(send);
    expect(onAnswer).toHaveBeenLastCalledWith('Email, Web');
  });

  it('sends a slider value with its unit, and free text once written', async () => {
    const onAnswer = vi.fn();
    render(<ScaleCard question="Availability" min={95} max={100} step={0.1} unit="%" suggestion={99.9} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Availability' }), { target: { value: '99.5' } });
    await userEvent.click(screen.getByRole('button', { name: /Send/ }));
    expect(onAnswer).toHaveBeenLastCalledWith('99.5 %');
    render(<TextCard question="Never happen?" onAnswer={onAnswer} />);
    const [, textSend] = screen.getAllByRole('button', { name: /Send/ });
    expect(textSend).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Never happen?' }), 'A lost request');
    await userEvent.click(textSend);
    expect(onAnswer).toHaveBeenLastCalledWith('A lost request');
  });

  it('shows an answered card as a read-only record', () => {
    render(<ChoiceCard question="Who first?" options={['Agents', 'Customers']} answered="Agents" onAnswer={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('pre-selects suggested technologies, lets the layer change, and skips those already chosen', async () => {
    const onSave = vi.fn();
    const catalog = [tech('r', 'React', 'framework'), tech('p', 'PostgreSQL', 'database'), tech('f', 'Fastify', 'framework'), tech('k', 'Kafka', 'messaging')];
    render(<StackPickCard question="Stack" suggestions={['React', 'postgresql']} catalog={catalog} current={[{ technologyId: 'k', layer: 'communication', version: '', note: '' }]} lang="en" editable onSave={onSave} />);
    expect(screen.queryByRole('button', { name: /Kafka/ })).toBeNull();
    expect(screen.getByRole('button', { name: /React/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Fastify/ }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Layer for Fastify' }), 'backend');
    await userEvent.click(screen.getByRole('button', { name: 'Add 3 to the stack' }));
    const [entries, names] = onSave.mock.calls[0];
    expect(names).toEqual(['React', 'PostgreSQL', 'Fastify']);
    expect(entries.map((e: { layer: string }) => e.layer)).toEqual(['frontend', 'data', 'backend']);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No technology matches.')).toBeInTheDocument();
  });

  it('places technologies in a sensible layer by default', () => {
    expect(defaultLayer(tech('a', 'Vue', 'framework'))).toBe('frontend');
    expect(defaultLayer(tech('b', 'Django', 'framework'))).toBe('backend');
    expect(defaultLayer(tech('c', 'Terraform', 'iac'))).toBe('iac');
  });

  it('lets reviewers accept or reject a proposal, and reports failures', async () => {
    const onAccept = vi.fn().mockRejectedValueOnce(new Error('Stale revision')).mockResolvedValue(undefined);
    const onReject = vi.fn().mockResolvedValue(undefined);
    const proposal = { proposalId: 'p', title: 'Problem', changes: 2, status: 'pending' as const };
    const { rerender } = render(<ProposalCard proposal={proposal} canReview onAccept={onAccept} onReject={onReject} onOpen={() => {}} />);
    expect(screen.getByText(/2 changes waiting for review/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Accept/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stale revision');
    await userEvent.click(screen.getByRole('button', { name: /Reject/ }));
    expect(onReject).toHaveBeenCalled();
    rerender(<ProposalCard proposal={{ ...proposal, status: 'accepted' }} canReview onAccept={onAccept} onReject={onReject} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
    expect(screen.getByText('accepted')).toBeInTheDocument();
    rerender(<ProposalCard proposal={proposal} canReview={false} onAccept={onAccept} onReject={onReject} onOpen={() => {}} />);
    expect(screen.getByText(/A reviewer will accept/)).toBeInTheDocument();
    rerender(<ProposalCard error="Unknown ids" canReview onAccept={onAccept} onReject={onReject} onOpen={() => {}} />);
    expect(screen.getByText(/Unknown ids/)).toBeInTheDocument();
    rerender(<ProposalCard running canReview onAccept={onAccept} onReject={onReject} onOpen={() => {}} />);
    expect(screen.getByText(/Preparing a proposal/)).toBeInTheDocument();
  });
});

describe('live document', () => {
  it('shows progress per section, opens one in place and edits a simple answer', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onFocus = vi.fn();
    const onAnswer = vi.fn();
    const onOpen = vi.fn();
    const spec = createSpec('00000000-0000-4000-8000-0000000000c1', 'New');
    const { rerender } = render(<LiveDocument spec={spec} editable focus={null} onFocus={onFocus} onSave={onSave} onAnswer={onAnswer} onOpen={onOpen} />);
    const head = screen.getByRole('button', { name: /Business & discovery/ });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(head);
    expect(onFocus).toHaveBeenCalledWith('discovery');
    rerender(<LiveDocument spec={spec} editable focus="discovery" onFocus={onFocus} onSave={onSave} onAnswer={onAnswer} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Answer in chat: Problem to solve/ }));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ id: 'discovery.1' }), 'discovery');
    await userEvent.click(screen.getByRole('button', { name: /Open Stakeholders/ }));
    expect(onOpen).toHaveBeenCalledWith('discovery', 'discovery.3');
    await userEvent.click(screen.getByRole('button', { name: /Edit Problem to solve/ }));
    const field = document.getElementById('live-discovery.1')!;
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.type(field, 'Requests get lost');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ sections: [{ id: 'discovery', answers: { 'discovery.1': { value: 'Requests get lost', state: 'answered', reason: '' } } }] }, 'Problem to solve');
  });

  it('hides editing for read-only users', () => {
    const spec = buildExampleSpec('00000000-0000-4000-8000-0000000000c2');
    render(<LiveDocument spec={spec} editable={false} focus="discovery" onFocus={() => {}} onSave={vi.fn()} onAnswer={() => {}} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Answer in chat/ }).length).toBeGreaterThan(0);
  });
});
