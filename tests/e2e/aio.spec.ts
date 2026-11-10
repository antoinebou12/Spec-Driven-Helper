import { test, expect } from '@playwright/test';

/**
 * AIO in a real browser: what an assistant or crawler gets from the running site. Many AI crawlers
 * do not run JavaScript, so the page is also loaded with JavaScript switched off.
 */
test('crawlers and assistants can read the product without signing in or running JavaScript', async ({ browser, request }) => {
  for (const [path, type, expected] of [
    ['/llms.txt', 'text/markdown', /^# SDD Studio\n\n> /],
    ['/llms-full.txt', 'text/markdown', /## MCP tools for coding agents[\s\S]*`propose_change`/],
    ['/robots.txt', 'text/plain', /User-agent: GPTBot\nAllow: \/\nDisallow: \/api\//],
    ['/sitemap.xml', 'application/xml', /<urlset/],
  ] as const) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type'], path).toContain(type);
    expect(await res.text(), path).toMatch(expected);
  }

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJs.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SDD Studio', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the product summary as text' })).toHaveAttribute('href', '/llms.txt');
  await noJs.close();

  const withJs = await browser.newPage();
  await withJs.goto('/');
  const jsonLd = JSON.parse((await withJs.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(jsonLd['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['SoftwareApplication', 'WebSite', 'FAQPage']);
  // With JavaScript the app renders and the no-JavaScript summary stays hidden.
  await expect(withJs.getByRole('heading', { name: 'Frequently asked questions' })).toBeHidden();
  await withJs.close();
});
