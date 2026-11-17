import { currentLocale } from '../i18n';

const TAGS = { pt: 'pt-BR', en: 'en-US', es: 'es' } as const;

export function formatDate(iso: string, withTime = false): string {
  return new Intl.DateTimeFormat(TAGS[currentLocale()], {
    dateStyle: 'long',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(iso));
}
