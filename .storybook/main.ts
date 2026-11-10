import type { StorybookConfig } from '@storybook/react-vite';

/** Component workshop for the web app. `pnpm exec storybook dev -p 6006` / `storybook build`. */
const config: StorybookConfig = {
  stories: ['../apps/web/src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  // The app's Vite config sets `root: apps/web` and an API proxy; stories need neither.
  viteFinal: async (config) => ({ ...config, root: process.cwd(), server: { ...config.server, proxy: undefined } }),
};
export default config;
