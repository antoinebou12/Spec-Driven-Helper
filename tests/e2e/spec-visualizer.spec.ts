import { expect, test } from '@playwright/test';
import { signIn, createProject, nav, expectAccessible } from './helpers';

test('visualizer opens recorded sections and fits desktop and phone', async ({ page }) => {
  await signIn(page);
  await createProject(page, `Visualizer ${Date.now()}`);
  await nav(page).getByRole('button', { name: 'Overview', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Specification visualizer' }).click();
  const visual = page.getByRole('region', { name: 'Specification visualizer' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await visual.getByRole('button', { name: /Business & discovery/ }).click();
    await expect(visual.getByRole('button', { name: 'Open section' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectAccessible(page, `specification visualizer ${width}`, '.spec-visualizer');
    await page.screenshot({ path: `test-results/spec-visualizer-${width}.png`, fullPage: true });
  }
  await visual.getByRole('button', { name: 'Open section' }).click();
  await expect(page).toHaveURL(/specification/);
});
