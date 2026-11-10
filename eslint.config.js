import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/** Layer rules mirror tests/architecture.test.ts so editors flag violations while typing. */
const restricted = (patterns) => ['error', { patterns }];

export default ts.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'storybook-static/**', 'lighthouse-report/**', '.runtime/**', 'apps/web/node_modules/**', '.pnpm-store/**', '.act/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': restricted([
        { group: ['**/apps/api/**', '../../api/**'], message: 'The web client talks to the API over HTTP only.' },
        { group: ['node:*', 'fastify', 'pg'], message: 'Server-only module in the browser bundle.' },
      ]),
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted([
        { group: ['node:*', 'fs', 'path', 'child_process', 'fastify', '@fastify/*', 'pg', 'react', 'react-dom', '@radix-ui/*'], message: 'The shared domain has no I/O and no frameworks.' },
        { group: ['**/apps/**'], message: 'The shared domain cannot depend on applications.' },
      ]),
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/db.ts', 'apps/api/src/postgres.ts'],
    rules: {
      'no-restricted-imports': restricted([
        { group: ['pg'], message: 'Use ./db; only the storage modules talk to database drivers.' },
        { group: ['**/apps/web/**', 'react', 'react-dom'], message: 'The API does not depend on the web client.' },
      ]),
    },
  },
);
