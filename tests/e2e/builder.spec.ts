import { expect, test } from '@playwright/test';
import { chooseComplete, expectAccessible, nav, signIn } from './helpers';

/**
 * Talking to the AI in Build with AI: a message streams a reply over AG-UI, the confirmed fact
 * arrives as a proposal card, accepting it updates the live document, and a simple answer can be
 * edited in place. (The guided questions themselves are covered in interview.spec.ts.)
 */
// Motion is off here: colours are checked settled, not mid-animation.
test.use({ reducedMotion: 'reduce' });

test('talks to the AI and reviews what it proposes', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill(`Chat ${Date.now()}`);
  await chooseComplete(dialog);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);

  const conversation = page.getByRole('region', { name: 'Conversation' });
  const documentPane = page.getByRole('region', { name: 'Document' });
  const discovery = documentPane.getByRole('button', { name: /Business & discovery/ });
  await expect(page.getByRole('combobox', { name: 'Model' })).toHaveValue('ollama::fake-model');
  await expect(conversation).toContainText('Let’s work on Business & discovery');
  await expect(discovery).toContainText('0 of');
  await expect(discovery).toHaveAttribute('aria-expanded', 'true');
  await expectAccessible(page, 'Build with AI, empty');

  // Typing is a message for the AI, not an answer to the open question.
  await conversation.getByPlaceholder('Ask a question…').fill('Support agents lose customer requests in email threads.');
  await conversation.getByRole('button', { name: 'Send message' }).click();
  await expect(conversation).toContainText('I will record that as the problem statement.');
  const card = conversation.locator('.builder-card').filter({ has: page.getByRole('heading', { name: 'Problem statement', exact: true }) });
  await expect(card).toContainText('waiting for review');
  await expect(nav(page).getByRole('button', { name: /Proposals/ })).toContainText('1');

  // Nothing changed yet: the proposal waits for review.
  await expect(discovery).toContainText('0 of');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card).toContainText('accepted');
  await expect(discovery).toContainText('1 of');

  // The accepted answer shows in the section, and another one is edited in place.
  await expect(documentPane).toContainText('Support agents lose customer requests in email threads.');
  await documentPane.getByRole('button', { name: 'Edit Business goals' }).click();
  await page.keyboard.type('Answer every request within one business day.');
  await documentPane.getByRole('button', { name: 'Save' }).click();
  await expect(documentPane).toContainText('Answer every request within one business day.');
  await expect(discovery).toContainText('2 of');
  await expectAccessible(page, 'Build with AI, after a proposal');

  // The conversation is kept across a reload.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Conversation' })).toContainText('Support agents lose customer requests');
});
