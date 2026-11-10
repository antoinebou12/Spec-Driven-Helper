import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { indexHtmlAdditions } from './packages/shared/src/aio';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3001';

/** AI optimisation: meta, Open Graph, JSON-LD and a no-JavaScript summary in index.html (packages/shared/src/aio.ts). */
export function aioHtml(): Plugin {
  return {
    name: 'sdd-aio-html',
    transformIndexHtml(html) {
      const { head, noscript } = indexHtmlAdditions();
      return html.replace('</head>', `    ${head}\n  </head>`).replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), aioHtml()],
  root: 'apps/web',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    // The AIO files are served by the API at the site root.
    proxy: Object.fromEntries(['/api', '/docs', '/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml'].map((path) => [path, apiUrl])),
  },
});
