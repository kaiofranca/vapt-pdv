import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'VaptPDV — Sistema de Ponto de Venda',
        short_name: 'VaptPDV',
        description: 'PDV e Operação de Salão para Bares e Lanchonetes',
        theme_color: '#2B2019',
        background_color: '#FBF7F1',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/comandas': { target: 'http://localhost:3000', changeOrigin: true },
      '/produtos': { target: 'http://localhost:3000', changeOrigin: true },
      '/usuarios': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/docs': { target: 'http://localhost:3000', changeOrigin: true },
      '/kds': { target: 'http://localhost:3001', changeOrigin: true },
      '/caixa': { target: 'http://localhost:3002', changeOrigin: true },
      '/gestao': { target: 'http://localhost:3003', changeOrigin: true },
      '/analytics': { target: 'http://localhost:3003', changeOrigin: true }
    }
  }
});
