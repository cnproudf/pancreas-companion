import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed at https://cnproudf.github.io/pancreas-companion/ so every asset URL,
// the service worker scope, and the manifest start_url hang off this base.
const BASE = '/pancreas-companion/'

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      // The hand-authored JSON in data/ stays at the top level of the repo so it
      // can be edited on GitHub without touching code. This alias lets src/
      // import it without relative-path spaghetti.
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pancreas Companion',
        short_name: 'Companion',
        description:
          'A calm companion for eating well with pancreatitis. Everything stays on your device.',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1C3A4B',
        background_color: '#F5F2EA',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole shell so the app opens cold with no signal. The
        // moment she most needs it is a basement dining room with no bars.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
