import { test, expect } from '@playwright/test';
import { signIn, expectAccessible } from './helpers';

test('the dashboard lists projects with progress and opens one', async ({ page }) => {
  await signIn(page);
  const name = `Dashboard ${Date.now()}`;
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Start from the complete example project').check();
  await dialog.getByLabel('Project name').fill(name);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  // New projects open on Build with AI.
  await expect(page.getByRole('heading', { name: 'Build with AI', level: 1 })).toBeVisible();

  await page.getByRole('complementary', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, level: 2 }) });
  await expect(card.getByRole('progressbar', { name: /^Completeness \d+ %$/ })).toBeVisible();
  await expect(card.getByRole('progressbar', { name: 'Security coverage 100 %' })).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
  await expectAccessible(page, 'dashboard');
  await page.screenshot({ path: 'test-results/ux/desktop-dashboard.png' });

  await card.getByRole('button', { name: `Open ${name}` }).click();
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Current project/ })).toHaveValue(/.+/);
});
