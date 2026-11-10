import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { signIn, nav, expectAccessible } from './helpers';

test('the .plan folder is exported from one project and imported into another', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New project' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Start from the complete example project').check();
  await dialog.getByLabel('Project name').fill(`Plan export ${Date.now()}`);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  // New projects open on Build with AI.
  await expect(page.getByRole('heading', { name: 'Build with AI', level: 1 })).toBeVisible();

  await nav(page).getByRole('button', { name: 'Publish & handoff' }).click();
  const card = page.getByRole('region', { name: '.plan folder' });
  const download = page.waitForEvent('download');
  await card.getByRole('link', { name: 'Export .plan folder' }).click();
  const zipPath = (await (await download).path())!;
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['.plan/specification.json', '.plan/tasks.md', '.plan/backlog.md', '.plan/spec/01-discovery.md']));

  await page.getByRole('button', { name: 'New project' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill(`Plan import ${Date.now()}`);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'Build with AI', level: 1 })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Publish & handoff' }).click();

  await page.getByRole('region', { name: '.plan folder' }).getByLabel('Import a .plan zip').setInputFiles(zipPath);
  const preview = page.locator('.plan-preview');
  await expect(preview).toContainText(/changes from \.plan\/specification\.json/);
  await expectAccessible(page, '.plan import preview');
  await page.getByRole('region', { name: '.plan folder' }).getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/\.plan imported: a specification proposal is waiting for review/)).toBeVisible();

  // Nothing is written until review: the proposal is waiting in Proposals.
  await nav(page).getByRole('button', { name: /Proposals/ }).click();
  await expect(page.getByRole('article', { name: /Import \.plan folder/ })).toBeVisible();
});
