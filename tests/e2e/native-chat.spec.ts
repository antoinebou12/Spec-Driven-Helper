import { expect, test } from '@playwright/test';
import { expectAccessible, nav, signIn } from './helpers';

test.use({ reducedMotion: 'reduce' });

test('Specification defaults to section chat, keeps form actions inline and moves diagnostics to Settings', async ({
  page,
}) => {
  await signIn(page);
  let aiRequests = 0;
  page.on('request', (request) => { if (/\/agent\?/.test(request.url()) && request.method() === 'POST') aiRequests++; });
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill(`Native chat ${Date.now()}`);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);
  await nav(page).getByRole('button', { name: 'Specification' }).click();
  await expect(page.getByRole('tab', { name: 'Chat', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const conversation = page.getByRole('region', { name: 'Conversation', exact: true });
  const question = 'What problem are you solving, and for whom?';
  const outline = page.getByRole('navigation', { name: 'Specification checklist' });
  await outline.getByRole('button', { name: 'Show questions of Business & discovery' }).click();
  await conversation.getByRole('textbox', { name: question, exact: true }).waitFor();
  await outline.getByRole('button', { name: /Problem to solve/ }).click();
  await outline.getByRole('button', { name: /Problem to solve/ }).click();
  await expect(conversation.getByRole('textbox', { name: question, exact: true })).toHaveCount(1);
  await expect(conversation).not.toContainText('Sure — here');
  await conversation
    .getByRole('textbox', { name: question, exact: true })
    .fill('Requests are lost between teams.');
  await conversation.getByRole('textbox', { name: question, exact: true }).press('Enter');
  await expect(conversation).toContainText('Requests are lost between teams.');
  await expectAccessible(page, 'Native section conversation');
  await expect(page.locator('.document-panel').getByText('discovery.md')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Edit', exact: true })).toHaveCount(0);
  const documentTools = page.getByRole('button', { name: 'Document tools' });
  await documentTools.click();
  await expect(page.getByRole('tab', { name: 'Edit', exact: true })).toBeVisible();
  await documentTools.click();

  await page.getByRole('tab', { name: 'Form', exact: true }).click();
  const card = page.getByRole('article', { name: question, exact: true });
  await expect(card.getByRole('textbox', { name: question, exact: true })).toHaveValue(
    'Requests are lost between teams.',
  );
  const help = card.getByRole('button', { name: 'Help and example' });
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await help.click();
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  await expect(card.locator('.example')).toBeVisible();
  await card.locator('header').getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Chat', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const proposal = conversation
    .locator('.builder-card')
    .filter({ has: page.getByRole('heading', { name: 'Suggested answer', exact: true }) });
  await expect(proposal).toContainText('waiting for review');
  await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(proposal).toContainText('accepted');
  const sent = aiRequests;
  await page.getByRole('tab', { name: 'Form', exact: true }).click();
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  await expect(conversation).toContainText('Welcome back');
  expect(aiRequests).toBe(sent);
  await expect(page).toHaveURL(/\/specification$/);

  for (const width of [1440, 1213, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const composer = page.getByTestId('copilot-chat-textarea');
    await expect(composer).toBeVisible();
    const box = await composer.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `test-results/native-chat-${width}.png`, fullPage: true });
  }
  await expectAccessible(page, 'Native section conversation on phone');
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav(page)
    .getByRole('button', { name: /Proposals/ })
    .click();
  await expect(page.getByRole('heading', { name: 'AI runs' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(page.getByRole('region', { name: 'AI assistant', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/proposals$/);
  await page.getByRole('button', { name: 'Close conversation' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'AI activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI runs' })).toBeVisible();
});
