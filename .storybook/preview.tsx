import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import { LanguageProvider } from '../apps/web/src/i18n';
import '../apps/web/src/style.css';

/** Toolbar switches for interface language and theme; axe runs on every story. */
const preview: Preview = {
  globalTypes: {
    lang: {
      description: 'Interface language',
      toolbar: { title: 'Language', icon: 'globe', items: [{ value: 'en', title: 'English' }, { value: 'fr', title: 'Français' }], dynamicTitle: true },
    },
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }], dynamicTitle: true },
    },
  },
  initialGlobals: { lang: 'en', theme: 'light' },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as string;
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
      }, [theme]);
      return (
        <LanguageProvider lang={context.globals.lang}>
          <div style={{ padding: 16, background: 'var(--bg)', color: 'var(--text)' }}>
            <Story />
          </div>
        </LanguageProvider>
      );
    },
  ],
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
};
export default preview;
