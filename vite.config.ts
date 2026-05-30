import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function devProxyEnabled(env: Record<string, string>): boolean {
  if (env.VITE_ENABLE_REMOTE_API === 'true') return true;
  if (env.VITE_ENABLE_REMOTE_API === 'false') return false;
  return Boolean(env.VITE_API_PROXY?.trim());
}

/**
 * React runtime MUST live in a single chunk:
 * react, react-dom, scheduler, jsx-runtime, use-sync-external-store.
 * Splitting scheduler causes: Cannot set properties of undefined (setting 'unstable_now').
 */
function isReactCoreModule(id: string): boolean {
  const norm = id.replace(/\\/g, '/');
  if (!norm.includes('node_modules')) return false;

  if (/node_modules\/react-dom\//.test(norm)) return true;
  if (/node_modules\/scheduler\//.test(norm)) return true;
  if (/node_modules\/use-sync-external-store\//.test(norm)) return true;
  if (/node_modules\/react-is\//.test(norm)) return true;
  // react package only — not react-dom, react-router, etc.
  if (/node_modules\/react\//.test(norm)) return true;

  return false;
}

function isCaptureModule(id: string): boolean {
  const norm = id.replace(/\\/g, '/');
  return (
    norm.includes('html2canvas') ||
    norm.includes('dom-to-image') ||
    norm.includes('jspdf')
  );
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isCapacitor = process.env.CAPACITOR === 'true';
  const useProxy = mode === 'development' && devProxyEnabled(env);
  const proxyTarget = env.VITE_API_PROXY?.trim() || 'http://127.0.0.1:3001';

  return {
    base: isCapacitor ? './' : '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: useProxy
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            '/health': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      /** Garante singleton do scheduler entre chunks de app e vendors. */
      dedupe: ['react', 'react-dom', 'scheduler'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'scheduler'],
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, '/');

            if (norm.includes('node_modules')) {
              if (isReactCoreModule(id)) return 'vendor-react';
              if (norm.includes('framer-motion')) return 'vendor-motion';
              if (norm.includes('lucide-react')) return 'vendor-icons';
              if (isCaptureModule(id)) return 'vendor-capture';
              if (norm.includes('@google/genai')) return 'vendor-ai';
              return 'vendor-misc';
            }

            if (norm.includes('/engines/')) return 'engines';
            if (
              norm.includes('/services/strategy/') ||
              norm.includes('/services/institutional/')
            ) {
              return 'strategy';
            }

            return undefined;
          },
        },
      },
    },
  };
});
