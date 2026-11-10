import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, openAdministration, signIn } from './helpers';

/** An administrator removes the example projects after a confirmation; other projects stay. */
test('removes example projects from Administration', async ({ page }) => {
  await signIn(page);
  const example = `Example ${Date.now()}`;
  await createProject(page, example, true);
  const own = `Own ${Date.now()}`;
  await createProject(page, own, false);

  await openAdministration(page);
  const panel = page.getByRole('region', { name: 'Example data' });
  await expect(panel).toContainText(example);
  await expect(panel).not.toContainText(own);
  await expectAccessible(page, 'Administration, example data');

  await panel.getByRole('button', { name: 'Remove example projects' }).click();
  const confirm = page.getByRole('dialog', { name: 'Remove example projects?' });
  await expect(confirm).toContainText('cannot be undone');
  await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText(/example projects? removed/);
  await expect(panel).toContainText('No example projects.');

  await page.reload();
  const projects = page.getByRole('combobox').first();
  await expect(projects).not.toContainText(example);
  await expect(projects).toContainText(own);
});
