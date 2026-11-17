import { DEFAULT_LOCALE, LOCALES, type Locale } from '@az/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const STORAGE_KEY = 'az-locale';
const HTML_LANG: Record<Locale, string> = { pt: 'pt-BR', en: 'en', es: 'es' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Preferência salva > idioma do navegador > português. */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Armazenamento bloqueado (modo privado etc.): segue com a detecção pelo navegador.
  }
  for (const lang of typeof navigator === 'undefined' ? [] : navigator.languages) {
    const short = lang.slice(0, 2).toLowerCase();
    if (isLocale(short)) return short;
  }
  return DEFAULT_LOCALE;
}

export const resources = {
  pt: { translation: pt },
  en: { translation: en },
  es: { translation: es },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  interpolation: { escapeValue: false }, // o React já escapa
  returnNull: false,
});

function syncDocument(lng: string) {
  if (typeof document !== 'undefined' && isLocale(lng))
    document.documentElement.lang = HTML_LANG[lng];
}
syncDocument(i18n.language);

i18n.on('languageChanged', (lng) => {
  syncDocument(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Sem persistência: o idioma vale só nesta aba.
  }
});

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

export default i18n;
