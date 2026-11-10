import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { signIn, expectAccessible } from './helpers';

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`OpenSpec preview, proposal, tasks and export (${viewport.width})`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(viewport);
    // Create through the same API, leaving browser steps focused on exchange controls.
    const response = await page.request.post('/api/v1/projects', {
      data: { name: `OpenSpec ${Date.now()}`, language: 'en' },
    });
    expect(response.ok()).toBeTruthy();
    const project = await response.json();
    const id = project.id;
    await page.goto(`/#/p/${id}/import`);
    await page.getByRole('tab', { name: 'OpenSpec', exact: true }).click();
    const zip = new JSZip();
    zip.file(
      'openspec/specs/scope/spec.md',
      '# Scope\n\n## Requirements\n\n### Requirement: REQ-EXCHANGE: Download\nThe system SHALL export recorded contracts.\n\n#### Scenario: Download\n- **WHEN** a user exports\n- **THEN** the recorded content is downloaded',
    );
    zip.file('tasks.md', '# Tasks\n\n- [ ] TASK-EXCHANGE Implement download');
    await page
      .getByLabel('OpenSpec ZIP')
      .setInputFiles({
        name: 'exchange.zip',
        mimeType: 'application/zip',
        buffer: await zip.generateAsync({ type: 'nodebuffer' }),
      });
    await expect(page.getByRole('button', { name: 'Propose', exact: true })).toBeEnabled();
    await expectAccessible(page, 'OpenSpec preview');
    await page.screenshot({
      path: `test-results/openspec-preview-${viewport.width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Propose', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
    const canonical = await (await page.request.get(`/api/v1/projects/${id}`)).json();
    expect(canonical.spec.items).not.toContainEqual(
      expect.objectContaining({ id: 'REQ-EXCHANGE' }),
    );
    await page.getByText('Tasks (1)', { exact: true }).click();
    await page.getByRole('button', { name: 'Import tasks', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Imported', exact: true })).toBeVisible();
    await page.goto(`/#/p/${id}/publishing`);
    await page.getByRole('combobox', { name: 'Export format' }).selectOption('openspec');
    await expect(page.getByText(/Draft\. Resolve diagnostics/)).toBeVisible();
    await expectAccessible(page, 'OpenSpec export');
    await page.screenshot({
      path: `test-results/openspec-export-${viewport.width}.png`,
      fullPage: true,
    });
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  });
}
