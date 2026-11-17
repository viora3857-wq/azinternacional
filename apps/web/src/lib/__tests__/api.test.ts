import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';

afterEach(() => vi.unstubAllGlobals());

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('api()', () => {
  it('chama /api na mesma origem, com JSON e cookie de sessão', async () => {
    const fn = mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(api('/auth/magic-link', { body: { email: 'a@b.co' } })).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/magic-link');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe('{"email":"a@b.co"}');
  });

  it('204 devolve undefined', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(api('/x', { body: {} })).resolves.toBeUndefined();
  });

  it('converte o corpo de erro em ApiError tipado', async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'VALIDATION_FAILED', fields: ['email'], requestId: 'r1' },
          }),
          {
            status: 400,
          },
        ),
    );
    const err = await api('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      fields: ['email'],
      requestId: 'r1',
    });
  });

  it('código desconhecido ou corpo não-JSON vira UNKNOWN (não confia no formato)', async () => {
    mockFetch(async () => new Response('<html>502</html>', { status: 502 }));
    await expect(api('/x')).rejects.toMatchObject({ code: 'UNKNOWN', status: 502 });
    mockFetch(
      async () => new Response(JSON.stringify({ error: { code: 'INVENTADO' } }), { status: 400 }),
    );
    await expect(api('/x')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('falha de rede vira NETWORK', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api('/x')).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
  });
});
