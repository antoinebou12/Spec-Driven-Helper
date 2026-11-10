import { expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { e2eOwner } from '../../playwright.config';

export async function signIn(page: Page) {
  // The first-run tour is covered by component tests; journeys start with it dismissed.
  await page.addInitScript(() => localStorage.setItem('sdd-tour-done', 'true'));
  await page.goto('/');
  await page.getByLabel('Email address').fill(e2eOwner.email);
  await page.getByLabel('Password', { exact: true }).fill(e2eOwner.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Project views' })).toBeVisible();
}

export async function createProject(page: Page, name: string, sample = true) {
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  if (sample) await dialog.getByLabel('Start from the complete example project').check();
  await dialog.getByLabel('Project name').fill(name);
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toBeHidden();
  // Project creation now opens Build with AI; these journeys exercise Specification.
  await expect(nav(page).getByRole('button', { name: 'Build with AI' })).toHaveClass(/active/);
  await nav(page).getByRole('button', { name: 'Specification' }).click();
  await page.getByRole('tab', { name: 'Form', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business & discovery', level: 2 })).toBeVisible();
}

/** New projects start at the essentials level; journeys about the full interview ask for the complete one. */
export const chooseComplete = (dialog: Locator) => dialog.getByRole('radio', { name: /Complete/ }).check();

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Project views' });

export async function openAdministration(page: Page) {
  await page
    .getByRole('complementary', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Administration' }).click();
  return page.getByRole('region', { name: 'Features' });
}

/**
 * axe on the page, or only inside `scope` (a CSS selector). Scope a modal dialog to itself: the page
 * behind it is inert, and its dimmed colors under the backdrop are not what anyone reads.
 */
export async function expectAccessible(page: Page, label: string, scope?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  const results = await (scope ? builder.include(scope) : builder).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')}`,
    ),
    label,
  ).toEqual([]);
}

export const savedStatus = (page: Page) => page.locator('.top-actions [role="status"]');
