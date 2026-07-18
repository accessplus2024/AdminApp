import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Por padrao o Vite so expoe variaveis VITE_*. Como o .env deste projeto usa os
  // nomes do Next.js (NEXT_PUBLIC_*), incluimos esse prefixo tambem — assim o
  // mesmo .env funciona sem precisar renomear nada.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
});
