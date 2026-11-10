import { test, expect, type Page } from '@playwright/test';
import { signIn, nav, expectAccessible } from './helpers';

/**
 * UX tour: visits every view of the example project on desktop and phone, saves screenshots to
 * test-results/ux/ for design review, and checks the layout basics people notice first — no
 * horizontal scrolling, no clipped or overlapping controls, no error banners, no console errors,
 * and no serious or critical axe (WCAG 2.2 AA) violations.
 */
const views = [
  'Build with AI',
  'Overview',
  'Technology stack',
  'Specification',
  'Requirements & decisions',
  'Proposals',
  'Readiness & baselines',
  'Implementation board',
  'Publish & handoff',
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) problems.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px > ${window.innerWidth}px)`);
    // Interactive controls that are visible must meet the WCAG 2.2 minimum target size.
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=hidden]), [role=tab]')) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === 'hidden' || el.closest('[aria-hidden=true], .sr-only, .monaco-editor')) continue;
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue; // inline text links are exempt
      // A checkbox or radio inside its label is clicked through the whole label (WCAG 2.5.8 spacing/equivalent).
      const label = el.closest('label');
      const lr = label?.getBoundingClientRect();
      const labelled = /^(checkbox|radio)$/.test((el as HTMLInputElement).type) && lr && lr.height >= 24 && lr.width >= 24;
      if (!labelled && (r.width < 24 || r.height < 24)) problems.push(`small target ${Math.round(r.width)}×${Math.round(r.height)}: ${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName}`);
      // Controls inside a horizontally scrollable container (wide tables) are reachable by scrolling it.
      const scroller = (() => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) return p;
        return null;
      })();
      if (!scroller && r.right > window.innerWidth + 1) problems.push(`control off screen: ${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40)}`);
    }
    return [...new Set(problems)].slice(0, 15);
  });
}

for (const device of [
  { name: 'desktop', width: 1440, height: 950 },
  { name: 'tablet', width: 1000, height: 800 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`UX tour on ${device.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    await page.setViewportSize({ width: 1440, height: 950 });
    await signIn(page);
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Start from the complete example project').check();
    await dialog.getByLabel('Project name').fill(`UX ${device.name} ${Date.now()}`);
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await expect(dialog).toBeHidden();
    await nav(page).getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    await page.setViewportSize({ width: device.width, height: device.height });

    const report: Record<string, string[]> = {};
    for (const view of views) {
      if (device.name === 'phone') {
        const menu = page.getByRole('button', { name: /^(Views|Vues):/ });
        if (await menu.isVisible().catch(() => false)) await menu.click();
      }
      await nav(page).getByRole('button', { name: view }).click();
      if (device.name === 'phone') await expect(page.getByRole('button', { name: /^Views:/ })).toHaveText(`Views: ${view}`);
      else await expect(nav(page).getByRole('button', { name: view })).toHaveAttribute('aria-current', 'page');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').getByText(/^(Loading|Chargement)/)).toHaveCount(0, { timeout: 30_000 });
      await page.screenshot({ path: `test-results/ux/${device.name}-${slug(view)}.png`, fullPage: true });
      await expect(page.locator('[role=alert]:visible').filter({ hasText: /\S/ })).toHaveCount(0);
      // WCAG 2.2 AA (axe) on every view, on both devices.
      await expectAccessible(page, `${view} on ${device.name}`);
      const problems = await layoutProblems(page);
      if (problems.length) report[view] = problems;
    }
    console.log(`UX ${device.name}:`, JSON.stringify(report, null, 1));
    expect(errors).toEqual([]);
    expect.soft(report).toEqual({});
  });
}
