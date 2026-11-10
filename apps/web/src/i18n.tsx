import { createContext, useCallback, useContext, type ReactNode } from 'react';
import type { Language, Localized } from '../../../packages/shared/src/templates';

/**
 * Interface language. Strings are written in both languages at the call site —
 * `l('Save', 'Enregistrer')` — so no translation can go missing. The document language of a
 * project is separate and stored on the specification.
 */
const LanguageContext = createContext<Language>('en');
export const LanguageProvider = ({ lang, children }: { lang: Language; children: ReactNode }) => (
  <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>
);
export function useLang() {
  return useContext(LanguageContext);
}
export function useL() {
  const lang = useContext(LanguageContext);
  return useCallback((en: string, fr: string) => (lang === 'fr' ? fr : en), [lang]);
}
export function useLocalized() {
  const lang = useContext(LanguageContext);
  return useCallback((v: Localized) => v[lang], [lang]);
}
export function formatDate(value: string | number | Date, lang: Language) {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
