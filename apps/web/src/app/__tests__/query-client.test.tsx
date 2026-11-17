import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { useMe } from '../../lib/queries';
import { createQueryClient } from '../query-client';

afterEach(() => vi.unstubAllGlobals());

function unauthorized() {
  return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401 });
}

function Probe() {
  const me = useMe();
  const other = useQuery({ queryKey: ['other'], queryFn: () => api('/other'), retry: false });
  return <p>{me.isError && other.isError ? 'done' : 'loading'}</p>;
}

describe('createQueryClient', () => {
  it('401 revalida /me uma vez, sem loop infinito', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return unauthorized();
      }),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Probe />
      </QueryClientProvider>,
    );
    await screen.findByText('done');
    // Dá tempo para um eventual loop aparecer.
    await new Promise((r) => setTimeout(r, 300));
    const meCalls = calls.filter((u) => u === '/api/me').length;
    expect(meCalls).toBeGreaterThanOrEqual(1);
    expect(meCalls).toBeLessThanOrEqual(2);
    await waitFor(() => expect(calls.filter((u) => u === '/api/other')).toHaveLength(1));
  });
});
