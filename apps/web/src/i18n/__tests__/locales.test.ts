import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';

/** Lista "caminho -> tipo" de todas as folhas, incluindo arrays de objetos (textos legais). */
function shape(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (Array.isArray(obj)) {
    out.set(prefix, `array:${obj.length}`);
    obj.forEach((v, i) => shape(v, `${prefix}[${i}]`).forEach((t, k) => out.set(k, t)));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj))
      shape(v, prefix ? `${prefix}.${k}` : k).forEach((t, kk) => out.set(kk, t));
  } else {
    out.set(prefix, typeof obj);
  }
  return out;
}

function leaves(obj: unknown, prefix = ''): [string, string][] {
  if (typeof obj === 'string') return [[prefix, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (obj && typeof obj === 'object')
    return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{(\w+)\}\}|<(\w+)>/g)].map((m) => m[1] ?? m[2]).sort();

describe.each([
  ['en', en],
  ['es', es],
])('traduções %s', (_name, locale) => {
  it('tem exatamente as mesmas chaves e formatos que pt', () => {
    expect([...shape(locale).entries()].sort()).toEqual([...shape(pt).entries()].sort());
  });

  it('mantém as mesmas variáveis {{x}} e tags <x> de cada texto', () => {
    const ptLeaves = new Map(leaves(pt));
    for (const [key, value] of leaves(locale)) {
      expect(placeholders(value), key).toEqual(placeholders(ptLeaves.get(key)!));
    }
  });
});

describe('conteúdo', () => {
  it.each([
    ['pt', pt],
    ['en', en],
    ['es', es],
  ])('%s: nenhum texto vazio', (_n, locale) => {
    for (const [key, value] of leaves(locale)) expect(value.trim(), key).not.toBe('');
  });

  it('interface sem emojis (regra de design)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const locale of [pt, en, es]) {
      for (const [key, value] of leaves(locale)) expect(emoji.test(value), key).toBe(false);
    }
  });
});
