import { test, expect } from '@playwright/test';
import { createProject, expectAccessible, nav, openAdministration, signIn } from './helpers';

test('the stack step offers infrastructure as code and checks licenses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page);
  await createProject(page, `Platform ${Date.now()}`, false);
  await nav(page).getByRole('button', { name: 'Technology stack' }).click();
  await expect(page.getByRole('heading', { name: 'Technology stack', level: 1 })).toBeVisible();

  const iac = page.getByRole('group', { name: 'Infrastructure as code' });
  await expect(iac).toContainText('Recommended');
  await page
    .getByRole('group', { name: 'Category' })
    .getByRole('button', { name: 'Infrastructure as code' })
    .click();
  await expect(page.getByLabel('Add Pulumi to a layer')).toBeVisible();
  await expect(page.getByLabel('Add React to a layer')).toHaveCount(0);
  await page
    .getByLabel('Add Terraform to a layer')
    .selectOption({ label: 'Infrastructure as code' });
  await expect(iac.getByText('Terraform', { exact: true })).toBeVisible();
  await page
    .getByLabel('Add OpenTofu to a layer')
    .selectOption({ label: 'Infrastructure as code' });
  await expect(iac.getByText('OpenTofu', { exact: true })).toBeVisible();

  const license = page.getByRole('region', { name: 'License check' });
  await expect(license).toContainText('BUSL-1.1');
  await expect(license).toContainText('Source-available');
  await expect(license).toContainText('MPL-2.0');
  await expect(license).toContainText('Weak copyleft');
  await expect(license).toContainText('Terraform (BUSL-1.1) is source-available');
  await expect(license).toContainText('in the Governance section');
  await expectAccessible(page, 'stack step with license check');
  await page.screenshot({ path: 'test-results/stack-license-check.png', fullPage: true });

  await page.getByRole('button', { name: /^Fill \d+ empty answers$/ }).click();
  await expect(page.getByText(/answers filled from your stack/)).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Infrastructure as code' })
      .getByText('OpenTofu', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('an administrator switches a feature off, and the interface and API follow', async ({
  page,
}) => {
  await signIn(page);
  await createProject(page, `Flags ${Date.now()}`, false);
  const board = nav(page).getByRole('button', { name: 'Implementation board' });
  await expect(board).toBeVisible();

  const flags = await openAdministration(page);
  const toggle = flags.getByRole('switch', { name: /Implementation board/ });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expectAccessible(page, 'administration');
  await flags.screenshot({ path: 'test-results/feature-flags.png' });

  try {
    await toggle.click();
    await expect(flags.getByText('unsaved')).toBeVisible();
    await flags.getByRole('button', { name: 'Save 1 change' }).click();
    await expect(page.getByText('Features updated.')).toBeVisible();
    await expect(board).toHaveCount(0);

    expect((await (await page.request.get('/api/v1/features')).json()).features.board).toBe(false);
    const projects = await (await page.request.get('/api/v1/projects')).json();
    const refused = await page.request.get(`/api/v1/projects/${projects[0].id}/board`);
    expect(refused.status()).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'feature-disabled', feature: 'board' });

    // Alt+9 follows the visible navigation, so it no longer opens the board.
    await page.keyboard.press('Alt+9');
    await expect(page.getByRole('heading', { name: 'Implementation board', level: 1 })).toHaveCount(
      0,
    );
  } finally {
    const panel = await openAdministration(page);
    const restore = panel.getByRole('switch', { name: /Implementation board/ });
    if ((await restore.getAttribute('aria-checked')) === 'false') {
      await restore.click();
      await panel.getByRole('button', { name: 'Save 1 change' }).click();
    }
  }
  await expect(board).toBeVisible();
});
