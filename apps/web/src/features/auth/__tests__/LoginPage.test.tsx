import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { renderWithProviders } from '../../../test/render';
import { LoginPage } from '../LoginPage';
import { MagicLinkPage } from '../MagicLinkPage';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

describe('LoginPage', () => {
  it('valida no cliente, com erros acessíveis, sem chamar a API', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText('E-mail institucional'), 'nao-e-email');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const input = screen.getByLabelText('E-mail institucional');
    expect(await screen.findByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Digite sua senha.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('senha errada mostra erro genérico traduzido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INVALID_CREDENTIALS' } }, 401)),
    );
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText('E-mail institucional'), 'a@escola.example');
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer-coisa');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('e-mail não confirmado oferece reenvio do link', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { code: 'EMAIL_NOT_VERIFIED' } }, 403))
      .mockResolvedValueOnce(json({ ok: true }, 202));
    vi.stubGlobal('fetch', fetchFn);
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText('E-mail institucional'), 'a@escola.example');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-correta-1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reenviar e-mail de confirmação' }),
    );
    expect(await screen.findByText(/enviamos um novo link/)).toBeInTheDocument();
    expect(fetchFn.mock.calls[1]![0]).toBe('/api/auth/verify-email/resend');
  });

  it('botão de olho mostra e oculta a senha, com estado anunciado', async () => {
    renderWithProviders(<LoginPage />);
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('troca de idioma traduz a tela', async () => {
    renderWithProviders(<LoginPage />);
    await i18n.changeLanguage('es');
    expect(await screen.findByLabelText('Correo institucional')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });
});

describe('MagicLinkPage', () => {
  it('envia e confirma sem revelar se o e-mail existe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ ok: true }, 202)),
    );
    renderWithProviders(<MagicLinkPage />);
    await userEvent.type(screen.getByLabelText('E-mail institucional'), 'Ana@Escola.Example');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));
    expect(await screen.findByRole('heading', { name: 'Confira seu e-mail' })).toBeInTheDocument();
    expect(screen.getByText(/Se ana@escola\.example tiver acesso/)).toBeInTheDocument();
  });

  it('mostra erro de rate limit com código de suporte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'RATE_LIMITED', requestId: 'abc' } }, 429)),
    );
    renderWithProviders(<MagicLinkPage />);
    await userEvent.type(screen.getByLabelText('E-mail institucional'), 'a@escola.example');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de acesso' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas seguidas');
    expect(screen.getByRole('alert')).toHaveTextContent('Código para suporte: abc');
  });
});
