import type { Me } from '@az/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { OnboardingPage } from '../OnboardingPage';

afterEach(() => vi.unstubAllGlobals());

const me: Me = {
  id: '1',
  email: 'aluno@escola.example',
  displayName: null,
  role: 'student',
  locale: 'pt',
  status: 'onboarding_required',
  mfaEnabled: false,
  hasPassword: true,
  school: { id: 's', name: 'Escola' },
  createdAt: new Date().toISOString(),
};

describe('OnboardingPage', () => {
  it('não pergunta idade nem dados de responsável', () => {
    renderWithProviders(<OnboardingPage me={me} />);
    expect(screen.queryByText(/18 anos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/responsável/)).not.toBeInTheDocument();
  });

  it('mostra todos os erros de uma vez e não chama a API', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    renderWithProviders(<OnboardingPage me={me} />);
    await userEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }));
    expect(await screen.findByText(/Use de 2 a 80 letras/)).toBeInTheDocument();
    expect(screen.getAllByText('É preciso aceitar para continuar.')).toHaveLength(2);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('envia os dados validados', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchFn);
    renderWithProviders(<OnboardingPage me={me} />);
    await userEvent.type(
      screen.getByLabelText('Como quer ser chamado(a)', { exact: false }),
      'Bia Souza',
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Termos de uso/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Política de privacidade/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }));
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: 'Bia Souza',
      locale: 'pt',
      acceptTerms: true,
      acceptPrivacy: true,
    });
  });

  it('links dos termos e da política têm texto acessível', () => {
    renderWithProviders(<OnboardingPage me={me} />);
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
