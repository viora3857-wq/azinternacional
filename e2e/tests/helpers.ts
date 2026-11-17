import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { timeStep, totp } from '../../apps/api/src/lib/totp';

export const uniqueEmail = (prefix = 'e2e') =>
  `${prefix}-${randomUUID().slice(0, 8)}@escola.example`;

/** Lê o último link do tipo pedido no outbox de desenvolvimento (só existe com EMAIL_PROVIDER=dev). */
export async function linkFromOutbox(
  request: APIRequestContext,
  to: string,
  tag: 'magic_link' | 'verify_email' | 'password_reset',
) {
  await expect
    .poll(async () => {
      const res = await request.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
      const { messages } = (await res.json()) as { messages: { tag: string; text: string }[] };
      return messages.find((m) => m.tag === tag)?.text ?? null;
    })
    .not.toBeNull();
  const res = await request.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
  const { messages } = (await res.json()) as { messages: { tag: string; text: string }[] };
  const text = messages.find((m) => m.tag === tag)!.text;
  const url = /(http:\/\/\S+#token=[A-Za-z0-9_-]{43})/.exec(text)?.[1];
  if (!url) throw new Error('link não encontrado no e-mail');
  return url;
}

/** Varredura automática WCAG 2.1 A/AA. Não substitui teste manual com leitor de tela. */
export async function expectAccessible(page: Page) {
  // Espera transições de cor (ex.: troca de tema) terminarem: medir no meio da animação dá falso positivo.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const results = await new AxeBuilder({
    // @axe-core/playwright tipa contra outra versão do playwright-core; em runtime a API é a mesma.
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'],
  })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any.map((a) => a.message).join(' ')}`).join(' | ')}`,
    ),
  ).toEqual([]);
}

export const PASSWORD = 'uma frase longa de teste';

/** Cria conta com senha e confirma o e-mail. Termina na tela de onboarding. */
export async function registerAndConfirm(page: Page, request: APIRequestContext, email: string) {
  await page.goto('/register');
  await page.getByLabel('E-mail institucional').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();
  await page.goto(await linkFromOutbox(request, email, 'verify_email'));
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function onboard(page: Page, name: string) {
  await page.getByLabel('Como quer ser chamado(a)').fill(name);
  await page.getByRole('checkbox', { name: /Termos de uso/ }).check();
  await page.getByRole('checkbox', { name: /Política de privacidade/ }).check();
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(page.getByRole('heading', { name: `Olá, ${name}` })).toBeVisible();
}

export async function loginWithPassword(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function requestLogin(page: Page, email: string) {
  await page.goto('/login/link');
  await page.getByLabel('E-mail institucional').fill(email);
  await page.getByRole('button', { name: 'Enviar link de acesso' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();
}

/** Código TOTP de um passo à frente, para nunca repetir o último código aceito. */
export const totpCode = (secret: string, stepsAhead = 0) =>
  totp(secret, Date.now() + stepsAhead * 30_000);

/** Espera o relógio chegar ao passo TOTP indicado (códigos já usados não valem de novo). */
export async function waitForTotpStep(page: Page, step: number) {
  while (timeStep(Date.now()) < step) await page.waitForTimeout(500);
}
export const currentTotpStep = () => timeStep(Date.now());
