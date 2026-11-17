import 'i18next';
import type pt from './locales/pt.json';

// Chaves de tradução checadas em tempo de compilação: chave inexistente quebra o typecheck.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof pt };
  }
}
