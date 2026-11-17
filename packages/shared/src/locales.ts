import { z } from 'zod';

export const LOCALES = ['pt', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt';
export const localeSchema = z.enum(LOCALES);
