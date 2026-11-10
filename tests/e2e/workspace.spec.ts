import { test, expect, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createProject, expectAccessible, savedStatus, signIn } from './helpers';

test('interview, Markdown edit, AI proposal, baseline approval and export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page);
  await createProject(page, `Journey ${Date.now()}`);

  // Guided interview with autosave.
  const goals = page.getByRole('textbox', { name: 'What outcomes should this project achieve?' });
  await goals.fill('Reduce status follow-up emails by 30% within one quarter.');
  await expect(savedStatus(page)).toHaveText('All changes saved');
  await expect(page.locator('.document-content .markdown')).toContainText('Reduce status follow-up emails by 30% within one quarter.');
  await expectAccessible(page, 'specification workspace');

  // French interface.
  await page.getByLabel('Interface language').selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Métier et découverte', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quels résultats ce projet doit-il atteindre ?' })).toBeVisible();
  await page.getByLabel('Langue de l’interface').selectOption('en');

  // Markdown editing in Monaco; free text is saved as written.
  await page.getByRole('button', { name: 'Document tools' }).click();
  await page.getByRole('tab', { name: 'Edit' }).click();
  const editor = page.locator('.monaco-editor .view-lines').first();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\nNotes from the discovery workshop.');
  await expect(page.locator('.editor-notice [role="status"]')).toHaveText('Saved', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.locator('.document-content .markdown')).toContainText('Notes from the discovery workshop.');

  // AI proposal: nothing changes until accepted.
  await page.locator('.interview-bottom').getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const proposal = page.locator('.builder-card').filter({ has: page.getByRole('heading', { name: 'Problem statement', exact: true }) });
  await expect(proposal).toBeVisible({ timeout: 30_000 });
  await expect(proposal).toContainText('waiting for review');
  await proposal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(proposal).toContainText('accepted');

  // Review every section, then approve and export the baseline.
  await page.keyboard.press('Alt+7');
  await expect(page.getByRole('heading', { name: 'Readiness & baselines' })).toBeVisible();
  const review = page.getByRole('button', { name: 'Mark reviewed' });
  await expect(review).toHaveCount(14);
  while ((await review.count()) > 0) {
    const before = await review.count();
    await review.first().click();
    await expect(review).toHaveCount(before - 1);
  }
  await expect(page.getByRole('heading', { name: 'Ready for baseline approval' })).toBeVisible();
  await expectAccessible(page, 'readiness');
  await page.getByLabel('Approval note').fill('Approved in the browser journey.');
  await page.getByRole('button', { name: /Approve revision \d+ as baseline/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Baseline approved' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('.baseline-list').getByRole('link', { name: 'JSON' }).first().click();
  const file = await download;
  const bundle = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(bundle.format).toBe('sdd-studio');
  expect(bundle.spec.sections.every((s: { status: string }) => s.status === 'reviewed')).toBe(true);
  // The fake streaming model copies the reviewed request into its proposal.
  expect(bundle.spec.sections[0].answers['discovery.1'].value).toContain('Review the “Business & discovery” section.');

  // The approved baseline becomes an implementation board; moves work by keyboard, and .plan exports.
  await page.keyboard.press('Alt+8');
  await expect(page.getByRole('heading', { name: 'Implementation board', level: 1 })).toBeVisible();
  // Approving the baseline already split the project into tasks; refreshing from it stays available.
  await expect(page.getByRole('button', { name: 'Refresh from baseline' })).toBeVisible();
  const todo = page.getByRole('region', { name: /^To do/ });
  await expect(todo.locator('.kanban-card').first()).toBeVisible();
  const first = todo.locator('.kanban-card').first();
  const id = (await first.locator('code').textContent())!;
  await first.getByLabel(`Move ${id} to another column`).selectOption('doing');
  const doing = page.getByRole('region', { name: /^In progress/ });
  await expect(doing.getByText(id, { exact: true })).toBeVisible();
  await expectAccessible(page, 'implementation board');
  const plan = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export .plan' }).click();
  const tasks = readFileSync((await (await plan).path())!, 'utf8');
  expect(tasks).toContain(`- [/] ${id} `);
  await page.reload();
  await expect(page.getByRole('region', { name: /^In progress/ }).getByText(id, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

async function secondSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  return page;
}

test('stale edits open a conflict view instead of overwriting', async ({ page, browser }) => {
  await signIn(page);
  const name = `Conflict ${Date.now()}`;
  await createProject(page, name, false);
  const other = await secondSession(browser);
  await other.getByRole('combobox', { name: 'Current project', exact: true }).selectOption({ label: name });
  await other.getByRole('navigation', { name: 'Project views' }).getByRole('button', { name: 'Specification' }).click();
  await other.getByRole('tab', { name: 'Form', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Business & discovery', level: 2 })).toBeVisible();

  const problem = 'What problem are you solving, and for whom?';
  await page.getByRole('textbox', { name: problem }).fill('First author wording.');
  await expect(savedStatus(page)).toHaveText('All changes saved');

  await other.getByRole('textbox', { name: problem }).fill('Second author wording.');
  const dialog = other.getByRole('dialog', { name: 'This specification changed while you were editing' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('First author wording.');
  await expect(dialog).toContainText('Second author wording.');
  await dialog.getByRole('button', { name: 'Keep the latest version' }).click();
  await expect(other.getByRole('textbox', { name: problem })).toHaveValue('First author wording.');
  // The discarded draft must not come back through autosave.
  await other.waitForTimeout(2500);
  await page.reload();
  await expect(page.getByRole('textbox', { name: problem })).toHaveValue('First author wording.');
  await other.context().close();
});

test('keyboard navigation and narrow screens', async ({ page }) => {
  await signIn(page);
  await createProject(page, `Keyboard ${Date.now()}`, false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Business & discovery', level: 2 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+2');
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  await page.keyboard.press('Alt+4');
  await expect(page.getByText('Questions 1–3 of 9')).toBeVisible();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.getByText('Questions 4–6 of 9')).toBeVisible();
  const splitter = page.getByRole('separator', { name: 'Resize interview panel' });
  const before = Number(await splitter.getAttribute('aria-valuenow'));
  await splitter.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await splitter.getAttribute('aria-valuenow'))).toBe(before + 16);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: 'Interview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Document' }).click();
  await expect(page.locator('.document-panel')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-workspace.png', fullPage: true });
});
