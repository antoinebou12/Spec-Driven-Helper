import { expect, test } from '@playwright/test';
import { chooseComplete, expectAccessible, nav, signIn } from './helpers';

/**
 * Answers you can interact with: asked to compare, the AI answers with a comparison drawn by the
 * app's own components; changing a weight re-ranks it, and recording the decision is an ordinary
 * message whose result is a proposal to review, never a direct change.
 */
test.use({ reducedMotion: 'reduce' });

test('compares options interactively and records the decision as a proposal', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill(`Compare ${Date.now()}`);
  await chooseComplete(dialog);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);

  const conversation = page.getByRole('region', { name: 'Conversation' });
  await conversation
    .getByPlaceholder('Ask a question…')
    .fill('Compare PostgreSQL and MongoDB for the request store');
  await conversation.getByRole('button', { name: 'Send message' }).click();

  const answer = conversation
    .locator('.builder-card')
    .filter({ has: page.getByRole('heading', { name: 'Database for the request store' }) });
  await expect(answer).toContainText('Interactive answer');
  await expect(answer).toContainText('Best fit with these weights: PostgreSQL (88/100).');
  await expect(answer).toContainText('Estimate from what you said about the team.');
  await expectAccessible(page, 'Interactive comparison');

  // What matters changes the answer, in place.
  const weight = answer.getByRole('slider', { name: /Team knows it/ });
  await weight.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await expect(answer).toContainText('Best fit with these weights: MongoDB (100/100).');
  await answer.getByRole('radio', { name: 'Scores' }).click();
  await expect(answer.getByRole('table')).toContainText('Used daily');

  // Recording it is a message from the person; what the AI records waits for review.
  await answer.getByRole('button', { name: 'Record MongoDB as the decision' }).click();
  await expect(conversation).toContainText(
    'Record MongoDB as our choice for “Database for the request store”.',
  );
  const proposal = conversation
    .locator('.builder-card')
    .filter({ has: page.getByRole('heading', { name: 'Problem statement', exact: true }) });
  await expect(proposal).toContainText('waiting for review');
  await expect(
    page
      .getByRole('region', { name: 'Document' })
      .getByRole('button', { name: /Business & discovery/ }),
  ).toContainText('0 of');
  await page.screenshot({ path: 'test-results/interactive-answer.png', fullPage: true });
});
