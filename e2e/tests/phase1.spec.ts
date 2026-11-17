import { expect, test } from '@playwright/test';
import {
  expectAccessible,
  linkFromOutbox,
  loginWithPassword,
  onboard,
  PASSWORD,
  registerAndConfirm,
  requestLogin,
  totpCode,
  uniqueEmail,
  currentTotpStep,
  waitForTotpStep,
} from './helpers';

test.describe('Fase 1: cadastro com senha, 2FA, recuperação e exclusão de conta', () => {
  // Qualquer violação da CSP de produção (mesma do vercel.json) reprova o teste.
  let cspViolations: string[] = [];
  test.beforeEach(({ page }) => {
    cspViolations = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) cspViolations.push(msg.text());
    });
  });
  test.afterEach(() => {
    expect(cspViolations).toEqual([]);
  });

  test('fluxo completo do aluno', async ({ page, request }) => {
    const email = uniqueEmail('aluno');

    // 1. Cadastro + confirmação de e-mail
    await page.goto('/register');
    await expectAccessible(page);
    await registerAndConfirm(page, request, email);
    expect(page.url()).not.toContain('token');

    // 2. Onboarding
    await expectAccessible(page);
    await onboard(page, 'Bia Menezes');
    await expectAccessible(page);

    // 3. Ativa 2FA
    await page.getByRole('link', { name: 'Configurar' }).click();
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await page.getByRole('button', { name: 'Ativar' }).click();
    await expect(page.getByAltText('QR code para configurar o app autenticador')).toBeVisible();
    const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
    const enabledAt = currentTotpStep();
    await page.getByLabel('Código').fill(totpCode(secret));
    await page.getByRole('button', { name: 'Confirmar e ativar' }).click();
    await expect(
      page.getByText('Verificação em duas etapas ativada.', { exact: false }),
    ).toBeVisible();
    await expectAccessible(page);

    // 4. Sai e entra com senha: senha errada falha; certa pede o código
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expectAccessible(page);
    await loginWithPassword(page, email, 'senha-errada-123');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
    await loginWithPassword(page, email, PASSWORD);
    await expect(page.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel('Código').fill(totpCode(secret, 1));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByRole('heading', { name: 'Olá, Bia Menezes' })).toBeVisible();

    // 5. Tema escuro passa na varredura de acessibilidade
    await page.getByRole('link', { name: 'Configurações' }).click();
    await page.getByText('Escuro', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectAccessible(page);

    // 6. Esqueci a senha: pede, redefine, sessão atual cai
    const context2 = await page.context().browser()!.newContext({ locale: 'pt-BR' });
    const other = await context2.newPage();
    await other.goto('/login');
    await other.getByRole('link', { name: 'Esqueci minha senha' }).click();
    await expect(
      other.getByRole('heading', { name: 'Esqueci minha senha', level: 1 }),
    ).toBeVisible();
    await other.getByLabel('E-mail institucional').fill(email);
    await other.getByRole('button', { name: 'Enviar link' }).click();
    await expect(other.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();
    await other.goto(await linkFromOutbox(request, email, 'password_reset'));
    await expect(other.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible();
    await expectAccessible(other);
    await other.getByLabel('Nova senha').fill('outra frase bem longa');
    await other.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(other.getByLabel('Nova senha')).toHaveAttribute('type', 'text');
    await other.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(other.getByRole('heading', { name: 'Senha alterada' })).toBeVisible();
    await context2.close();

    // A sessão aberta antes da redefinição foi encerrada.
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);

    // 7. Entra com a nova senha + 2FA e exclui a conta (LGPD)
    await loginWithPassword(page, email, 'outra frase bem longa');
    // Os códigos dos passos enabledAt e enabledAt+1 já foram usados: espera o próximo.
    await waitForTotpStep(page, enabledAt + 1);
    await page.getByLabel('Código').fill(totpCode(secret, 1));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByRole('heading', { name: 'Olá, Bia Menezes' })).toBeVisible();
    await page.getByRole('link', { name: 'Configurações' }).click();
    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir conta definitivamente?' });
    await expect(dialog.getByRole('button', { name: 'Excluir definitivamente' })).toBeDisabled();
    await dialog.getByLabel('E-mail da conta').fill(email);
    await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await loginWithPassword(page, email, 'outra frase bem longa');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
  });

  test('login por magic link continua disponível; link inválido mostra erro', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('link');
    await page.goto('/login');
    await page.getByRole('button', { name: 'Receber link de acesso por e-mail' }).click();
    await expect(page.getByRole('heading', { name: 'Entrar com link' })).toBeVisible();
    await expectAccessible(page);
    await requestLogin(page, email);
    await page.goto(await linkFromOutbox(request, email, 'magic_link'));
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.goto(`/login/verify#token=${'x'.repeat(43)}`);
    await expect(page.getByRole('heading', { name: 'Link inválido' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('expirou ou já foi usado');
    await expectAccessible(page);
  });

  test('páginas legais e idioma', async ({ page }) => {
    const res = await page.goto('/privacy');
    expect(res?.headers()['content-security-policy']).toContain("script-src 'self'");
    await expect(
      page.getByRole('heading', { name: 'Política de privacidade', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '7. Adolescentes' })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel('Idioma').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByLabel('Language').selectOption('es');
    await expect(
      page.getByRole('heading', { name: 'Política de privacidad', level: 1 }),
    ).toBeVisible();
  });

  test('@mobile cadastro e menu no celular', async ({ page, request }) => {
    const email = uniqueEmail('mobile');
    await registerAndConfirm(page, request, email);
    await onboard(page, 'Caio Prado');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expectAccessible(page);
    await page.locator('#mobile-menu').getByRole('link', { name: 'Configurações' }).click();
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await expect(page.locator('#mobile-menu')).toHaveCount(0);
  });
});
