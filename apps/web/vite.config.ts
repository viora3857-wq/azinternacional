/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Os mesmos cabeçalhos de segurança do Vercel (CSP etc.) valem no `vite preview`,
// então o E2E quebra se a CSP de produção bloquear algo do app.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]),
);

// Em dev e preview o front chama /api na MESMA origem; o Vite repassa para a API.
// Assim o cookie de sessão é first-party e nenhuma chave vai para o navegador.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 5173, strictPort: true, proxy, headers: securityHeaders },
  build: { sourcemap: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
});
