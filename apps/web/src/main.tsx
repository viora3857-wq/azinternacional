import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/fraunces';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { router } from './app/router';
import './i18n';
import { applyTheme, getThemePref } from './lib/theme';
import './styles/index.css';

applyTheme(getThemePref());

const root = document.getElementById('root');
if (!root) throw new Error('#root não encontrado');

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
