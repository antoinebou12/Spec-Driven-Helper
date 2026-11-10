import { test, expect } from '@playwright/test';
import { createProject, expectAccessible, nav, openAdministration, signIn } from './helpers';

test('search flag hides the dialog and its shortcut, and legacy search links still work when enabled', async ({ page }) => {
  await signIn(page);
  await createProject(page, `Search flags ${Date.now()}`);
  const root = page.url().replace(/\/specification$/, '');
  await page.goto(`${root}/search`);
  await expect(page.getByRole('dialog', { name: /^Search:/ })).toBeVisible();
  await page.keyboard.press('Escape');
  const flags = await openAdministration(page);
  try {
    await flags.getByRole('switch', { name: /Section search/ }).click();
    await flags.getByRole('button', { name: 'Save 1 change' }).click();
    await expect(page.getByRole('button', { name: 'Search current project' })).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: /^Search:/ })).toHaveCount(0);
    await page.goto(`${root}/search`);
    await expect(page.getByRole('dialog', { name: /^Search:/ })).toHaveCount(0);
  } finally {
    const panel = await openAdministration(page);
    const toggle = panel.getByRole('switch', { name: /Section search/ });
    if (await toggle.getAttribute('aria-checked') === 'false') {
      await toggle.click();
      await panel.getByRole('button', { name: 'Save 1 change' }).click();
    }
  }
  await expect(page.getByRole('button', { name: 'Search current project' })).toBeVisible();
});

test('published guides expose administration and access documentation', async ({ page }) => {
  await page.goto('/docs/');
  await page.getByRole('link', { name: 'Administration and access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Administration and access', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Roles', exact: true })).toBeVisible();
  await expectAccessible(page, 'administration guide');
  await page.screenshot({ path: 'test-results/review-administration-guide.png', fullPage: true });
});

test('review feedback: compact exports, readiness, collapsible sections and top-bar search', async ({
  page,
}) => {
  await signIn(page);
  await createProject(page, `Browser review ${Date.now()}`);
  const projectRoot = page.url().replace(/\/specification$/, '');
  await expect(
    nav(page).getByRole('button', { name: 'Technology radar', exact: true }),
  ).toHaveCount(0);
  await expect(nav(page).getByRole('button', { name: 'Open questions', exact: true })).toHaveCount(
    0,
  );
  await expect(nav(page).getByRole('button', { name: 'Search sections', exact: true })).toHaveCount(
    0,
  );

  for (const width of [1440, 919, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Hide sections', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Specification checklist' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Show sections', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Specification checklist' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Hide sections', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show sections', exact: true })).toBeVisible();
  await expectAccessible(page, 'phone collapsed outline');
  await page.screenshot({ path: 'test-results/review-outline-phone.png', fullPage: true });
  await page.setViewportSize({ width: 919, height: 846 });

  await page.getByRole('button', { name: 'Search current project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Search:/ });
  await dialog.getByRole('searchbox').fill('customer');
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(dialog.getByRole('list', { name: 'Matching sections' })).toBeVisible();
  await expectAccessible(page, 'project search dialog');
  await page.screenshot({ path: 'test-results/review-search-tablet.png', fullPage: true });
  await dialog.getByRole('list').getByRole('button').first().click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.goto(`${projectRoot}/questions`);
  await expect(page.getByRole('button', { name: 'Show sections', exact: true })).toBeVisible();
  await page.goto(`${projectRoot}/catalog`);
  await expect(page.getByRole('heading', { level: 1, name: 'Technology stack' })).toBeVisible();
  await nav(page).getByRole('button', { name: 'Overview', exact: true }).click();
  const sections = page.locator('details').filter({ has: page.locator('summary#modules-title') });
  await sections.locator('summary').click();
  await expect(sections).not.toHaveAttribute('open', '');
  await sections.locator('summary').press('Enter');
  await expect(sections).toHaveAttribute('open', '');

  await nav(page).getByRole('button', { name: 'Publish & handoff' }).click();
  await page.getByLabel('Export format').selectOption('json');
  await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute(
    'href',
    /\/export\/json$/,
  );
  expect(await page.getByLabel('Export format').locator('optgroup').count()).toBe(3);
  await expectAccessible(page, 'compact exports');
  await page.screenshot({ path: 'test-results/review-publishing-tablet.png', fullPage: true });

  await nav(page).getByRole('button', { name: 'Readiness & baselines' }).click();
  await page.getByText('Sections not reviewed', { exact: false }).click();
  await page.getByRole('link', { name: 'Review discovery', exact: true }).click();
  await expect(page.locator('#section-review-discovery')).toBeFocused();
  // Focus scrolls the review row into view. Audit from the page top so the sticky header
  // does not partially cover an unrelated link and report its clipped target size.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectAccessible(page, 'readiness review targets');
  await page.screenshot({ path: 'test-results/review-readiness-tablet.png', fullPage: true });
});

test('Overview import and Settings integrations work on desktop and phone', async ({ page }) => {
  await signIn(page);
  await createProject(page, `Navigation ${Date.now()}`);
  await nav(page).getByRole('button', { name: 'Overview' }).click();
  await expect(nav(page).getByRole('button', { name: 'Import existing work' })).toHaveCount(0);
  await expect(
    page.getByText('Completeness combines required answers', { exact: false }),
  ).toBeHidden();
  await page.screenshot({ path: 'test-results/overview-clean-desktop.png', fullPage: true });
  await expectAccessible(page, 'concise overview');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Import existing work' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import existing work' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Existing repository' })).toBeVisible();
  await expectAccessible(page, 'phone import dialog');
  await page.screenshot({ path: 'test-results/import-phone.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Integrations' }).click();
  await expect(page.getByRole('heading', { name: 'Coding agents (MCP)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connectors' })).toBeVisible();
  await expect(page.getByText('GitLab', { exact: true })).toBeVisible();
  await expectAccessible(page, 'settings integrations');
  await page.screenshot({ path: 'test-results/settings-integrations.png', fullPage: true });
  await nav(page).getByRole('button', { name: 'Publish & handoff' }).click();
  await expect(page.getByRole('heading', { name: 'Coding agents (MCP)' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Connectors' })).toHaveCount(0);
});
