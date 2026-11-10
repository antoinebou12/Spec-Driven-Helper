import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Generates the application icons from one programmatic definition (a stack of specification
 * layers on the brand blue): favicon.svg, PNG app icons, a maskable icon and the web manifest.
 * Run with `pnpm icons` after changing the mark or colours; outputs are committed.
 */
const brand = { background: '#235ee8', foreground: '#ffffff', theme: '#2f5bd3', surface: '#fafafa' };
const out = join('apps', 'web', 'public');

/** The mark on a 32-unit grid; `inset` shrinks it into the maskable safe zone. */
function mark({ rounded = true, inset = 0 }: { rounded?: boolean; inset?: number } = {}) {
  const scale = (32 - inset * 2) / 32;
  const layers = 'm16 6 10 6-10 6-10-6zm-10 12 10 6 10-6m-20 6 10 6 10-6';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`,
    `<rect width="32" height="32" rx="${rounded ? 8 : 0}" fill="${brand.background}"/>`,
    `<g transform="translate(${inset} ${inset}) scale(${scale})">`,
    `<path d="${layers}" fill="none" stroke="${brand.foreground}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 -2)"/>`,
    `</g></svg>`,
  ].join('');
}

const pngs = [
  { file: 'icon-192.png', size: 192, svg: mark() },
  { file: 'icon-512.png', size: 512, svg: mark() },
  // Maskable icons are cropped to a circle or squircle: full-bleed background, mark inside the 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, svg: mark({ rounded: false, inset: 4 }) },
  { file: 'apple-touch-icon.png', size: 180, svg: mark({ rounded: false, inset: 3 }) },
];

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'favicon.svg'), `${mark()}\n`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, svg } of pngs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.locator('svg').screenshot({ path: join(out, file), omitBackground: true });
    console.log(`wrote ${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}

const manifest = {
  name: 'SDD Studio',
  short_name: 'SDD Studio',
  description: 'Design, review and publish your software specification.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: brand.surface,
  theme_color: brand.theme,
  icons: [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(out, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('wrote favicon.svg and manifest.webmanifest');
