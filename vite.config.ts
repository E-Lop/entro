import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB (bundle is ~2.65 MB)
      },
      includeAssets: ['icons/favicon-32x32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'entro - Food Expiry Tracker',
        short_name: 'entro',
        description: 'Gestisci le scadenze degli alimenti e riduci gli sprechi',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Rolldown non supporta più manualChunks in forma oggetto:
        // si usa advancedChunks.groups con regex sul path del modulo.
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/ },
            { name: 'react-query', test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/ },
            { name: 'supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/ },
            { name: 'date-fns', test: /[\\/]node_modules[\\/]date-fns[\\/]/ },
            { name: 'zxing', test: /[\\/]node_modules[\\/]@zxing[\\/](browser|library)[\\/]/ },
            { name: 'forms', test: /[\\/]node_modules[\\/](react-hook-form|@hookform[\\/]resolvers|zod)[\\/]/ },
            { name: 'ui-utils', test: /[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/ },
          ],
        },
      },
    },
    // heic2any (HEIC→JPEG WASM decoder) is ~1.3MB but loaded on-demand only for iPhone HEIC uploads
    chunkSizeWarningLimit: 1400,
  },
})
