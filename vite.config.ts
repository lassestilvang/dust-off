import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { handleGeminiProxyRequest } from './api/_lib/geminiProxy';

const geminiDevProxyPlugin = () => {
  return {
    name: 'dustoff-gemini-dev-proxy',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            req: import('node:http').IncomingMessage & { body?: unknown },
            res: import('node:http').ServerResponse,
            next: (error?: Error) => void,
          ) => Promise<void>,
        ) => void;
      };
    }) {
      server.middlewares.use('/api/gemini', async (req, res, next) => {
        try {
          await handleGeminiProxyRequest(req, res);
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  const isAnalyzeEnabled = env.ANALYZE === 'true';

  const plugins = [
    react(),
    geminiDevProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'DustOff',
        short_name: 'DustOff',
        description: 'Migrate legacy repositories and snippets to Next.js.',
        theme_color: '#0c1222',
        background_color: '#0c1222',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ];

  if (isAnalyzeEnabled) {
    plugins.push(
      visualizer({
        filename: 'dist/bundle-stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    );
  }

  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            lucide: ['lucide-react'],
          },
        },
      },
    },
  };
});
