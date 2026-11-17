// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Lê os tokens de um bloco do tokens.css. */
function tokens(block: 'light' | 'dark'): Record<string, string> {
  const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
  const start =
    block === 'light' ? css.indexOf(':root {') : css.indexOf(":root[data-theme='dark']");
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--az-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [texto, fundo, mínimo]. 4.5 = texto normal (WCAG AA). 3 = componentes de interface (1.4.11).
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-2', 4.5],
  ['ink-muted', 'bg', 4.5],
  ['ink-muted', 'surface', 4.5],
  ['ink-muted', 'surface-2', 4.5],
  ['primary', 'bg', 4.5],
  ['primary', 'surface', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'primary-hover', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['ink', 'info-soft', 4.5],
  ['ink', 'danger-soft', 4.5],
  ['ink', 'success-soft', 4.5],
  ['ink', 'warning-soft', 4.5],
  ['on-primary', 'danger', 4.5],
  ['on-brand', 'brand', 4.5],
  ['brand-accent', 'brand', 3],
  ['border-strong', 'surface', 3],
  ['border-strong', 'bg', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
];

describe.each(['light', 'dark'] as const)('contraste WCAG AA — tema %s', (theme) => {
  const t = tokens(theme);
  it('tem todos os tokens', () => {
    for (const [fg, bg] of PAIRS) {
      expect(t[fg], fg).toBeDefined();
      expect(t[bg], bg).toBeDefined();
    }
  });
  it.each(PAIRS)('%s sobre %s >= %s:1', (fg, bg, min) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
  });
});
