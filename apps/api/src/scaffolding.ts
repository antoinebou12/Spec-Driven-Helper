import JSZip from 'jszip';
import type { Spec } from '../../../packages/shared/src/schema';
import { implementationZip } from './exports';
export async function scaffold(spec: Spec) {
  const zip = await JSZip.loadAsync(await implementationZip(spec));
  const name =
    spec.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'new-project';
  zip.file(
    'package.json',
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite --host 127.0.0.1',
          api: 'tsx watch server/index.ts',
          build: 'tsc --noEmit && vite build',
          test: 'vitest run',
          lint: 'eslint .',
        },
        dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0', fastify: '^5.6.1' },
        devDependencies: {
          typescript: '^5.9.3',
          vite: '^7.2.2',
          '@vitejs/plugin-react': '^5.1.0',
          '@types/react': '^19.2.2',
          '@types/react-dom': '^19.2.2',
          '@types/node': '^24.10.0',
          tsx: '^4.20.6',
          vitest: '^3.2.4',
          eslint: '^9.39.0',
          'typescript-eslint': '^8.46.2',
        },
      },
      null,
      2,
    ),
  );
  zip.file(
    'index.html',
    '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Application starter</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
  );
  zip.file(
    'src/main.tsx',
    `import React from 'react';\nimport {createRoot} from 'react-dom/client';\ncreateRoot(document.getElementById('root')!).render(<main><h1>{${JSON.stringify(spec.name)}}</h1><p>Implement the approved requirements in .plan/.</p></main>);\n`,
  );
  zip.file(
    'server/app.ts',
    `import Fastify from 'fastify';\nexport function buildApp(){const app=Fastify();app.get('/api/health',async()=>({status:'ok'}));return app;}\n`,
  );
  zip.file(
    'server/index.ts',
    `import {buildApp} from './app';\nawait buildApp().listen({host:'127.0.0.1',port:3001});\n`,
  );
  zip.file(
    'tests/health.test.ts',
    `import {it,expect} from 'vitest';\nimport {buildApp} from '../server/app';\nit('serves health status',async()=>{const app=buildApp();const res=await app.inject('/api/health');expect(res.statusCode).toBe(200);expect(res.json()).toEqual({status:'ok'});await app.close();});\n`,
  );
  zip.file(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['src', 'server', 'tests'],
    }),
  );
  zip.file(
    'vite.config.ts',
    `import {defineConfig} from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({plugins:[react()],server:{proxy:{'/api':'http://127.0.0.1:3001'}}});\n`,
  );
  zip.file(
    'eslint.config.js',
    `import ts from 'typescript-eslint';\nexport default ts.config(...ts.configs.recommended);\n`,
  );
  zip.file('.gitignore', 'node_modules/\ndist/\n.env\n');
  zip.file(
    'README.md',
    `# ${spec.name}\n\nGenerated from approved specification revision ${spec.revision}, recipe react-fastify@1.0.0. This is a starting structure, not an implementation of the requirements.\n\n## Windows, macOS and Linux\n\nInstall Node.js 24 LTS and pnpm. On Windows use PowerShell; on macOS/Linux use your shell. Run pnpm install, pnpm dev and (in another terminal) pnpm api. Run pnpm test, pnpm lint and pnpm build before committing.\n\n## Docker\n\nUse the included Dockerfile for the web build. Backend production hosting must be configured from the approved delivery specification.\n\n## Development\n\nRead .plan/plan.md and .plan/designs.md. Update .plan/tasks.md, .plan/backlog.md and .plan/changes.md for every coherent implementation change.\n`,
  );
  zip.file(
    'Dockerfile',
    'FROM node:24-bookworm-slim AS build\nWORKDIR /app\nCOPY . .\nRUN corepack enable && pnpm install && pnpm build\nFROM nginx:alpine\nCOPY --from=build /app/dist /usr/share/nginx/html\n',
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
