import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { createProject, expectAccessible, nav, signIn } from './helpers';

async function repositoryArchive() {
  const zip = new JSZip();
  zip.file(
    'shop/package.json',
    JSON.stringify({ name: 'shop', license: 'MIT', dependencies: { react: '^19.0.0', fastify: '^5.0.0', pg: '^8.0.0' }, devDependencies: { vitest: '^3.0.0' } }),
  );
  zip.file('shop/Dockerfile', 'FROM node:24-slim\nCMD ["node", "server.js"]\n');
  zip.file('shop/README.md', '# Shop\n\nOnline ordering for a bakery.\n');
  zip.file('shop/.env', 'DATABASE_PASSWORD=do-not-read-me\n');
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('a repository archive is imported by rules as a reviewable proposal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page);
  await createProject(page, `Import ${Date.now()}`, false);
  await nav(page).getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Import existing work' }).click();
  await expect(page.getByRole('dialog', { name: 'Import existing work' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Existing repository' })).toHaveAttribute('aria-selected', 'true');

  const settings = page.getByRole('region', { name: 'Import settings' });
  await settings.getByLabel('Repository archive (.zip, up to 25 MB)').setInputFiles({
    name: 'shop.zip',
    mimeType: 'application/zip',
    buffer: await repositoryArchive(),
  });
  await settings.getByRole('button', { name: 'Analyse and propose changes' }).click();

  const result = page.getByRole('region', { name: 'Import result' });
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText('files analysed');
  await expect(result.getByRole('table')).toContainText('react');
  await expect(result.getByRole('table')).toContainText('fastify');
  await expect(result).not.toContainText('do-not-read-me');
  await expectAccessible(page, 'import result');
  await page.screenshot({ path: 'test-results/import-result.png', fullPage: true });

  await result.getByRole('button', { name: 'Review the proposal' }).click();
  const proposal = page.getByRole('article', { name: 'Import from repository (shop.zip)' });
  await expect(proposal).toBeVisible();
  await expect(proposal).not.toContainText('do-not-read-me');
  await proposal.getByRole('button', { name: 'Accept changes' }).click();
  await expect(proposal.getByRole('button', { name: 'Accept changes' })).toBeHidden();

  await nav(page).getByRole('button', { name: 'Technology stack' }).click();
  await expect(page.getByText('React', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a pasted document is mapped to questions without touching the specification', async ({ page }) => {
  await signIn(page);
  await createProject(page, `Notes ${Date.now()}`, false);
  await nav(page).getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Import existing work' }).click();
  await page.getByRole('tab', { name: 'Existing document' }).click();
  const settings = page.getByRole('region', { name: 'Import settings' });
  await settings.getByLabel('…or paste text').fill('## Problem to solve\n\nBakery customers cannot order online.\n\n## Random heading\n\nKept as notes.');
  await settings.getByRole('button', { name: 'Analyse and propose changes' }).click();
  const result = page.getByRole('region', { name: 'Import result' });
  await expect(result).toContainText('“Problem to solve” →', { timeout: 30_000 });
  await expect(result).toContainText('“Random heading” → kept as notes');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(nav(page).getByRole('button', { name: /Proposals/ })).toContainText('1');
});
