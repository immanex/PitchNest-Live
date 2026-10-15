import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

/**
 * Long-lived vendor chunks. Libraries change far less often than app code, so
 * giving each family its own file lets browsers keep them cached across
 * deploys instead of re-downloading one monolithic bundle after every release.
 *
 * Groups are chosen so dependencies only point "down" (charts/ui/motion →
 * utils/react), never back up, which avoids circular chunk imports. Keep page-
 * specific libraries (charts, forms) in their own groups: if pages are later
 * lazy-loaded, those files then load only with the pages that need them.
 * Packages not listed fall back to Rollup's default chunking.
 */
const VENDOR_GROUPS: Array<[chunk: string, matches: (pkg: string) => boolean]> = [
  ['vendor-react', (p) => ['react', 'react-dom', 'scheduler', 'react-is', 'use-sync-external-store', 'react-router', 'react-router-dom', 'cookie', 'set-cookie-parser'].includes(p)],
  ['vendor-charts', (p) => p === 'recharts' || p === 'victory-vendor' || p.startsWith('d3-') || ['internmap', 'decimal.js-light', '@reduxjs/toolkit', 'redux', 'redux-thunk', 'reselect', 'react-redux', 'immer', 'es-toolkit', 'eventemitter3'].includes(p)],
  ['vendor-motion', (p) => ['motion', 'framer-motion', 'motion-dom', 'motion-utils', 'lenis'].includes(p)],
  ['vendor-forms', (p) => ['zod', 'react-hook-form', '@hookform/resolvers'].includes(p)],
  ['vendor-utils', (p) => ['tslib', 'clsx', 'tailwind-merge', 'js-cookie', 'tiny-invariant', '@vercel/analytics'].includes(p)],
  // Deliberately NOT grouped: lucide-react icons and Radix/Floating UI
  // primitives. Each page uses a different handful, so letting Rollup split
  // them per page keeps the landing page from downloading every icon and menu
  // in the app (measured: about 15 KB gzipped saved on first load).
];

function vendorChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, '/');
  const marker = normalized.lastIndexOf('/node_modules/');
  if (marker === -1) return undefined;
  const parts = normalized.slice(marker + '/node_modules/'.length).split('/');
  const pkg = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  return VENDOR_GROUPS.find(([, matches]) => matches(pkg))?.[0];
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Stable localhost certificate (generated once, trusted once in Windows).
  // basicSssl() minted a NEW self-signed cert on every restart, so the browser
  // re-warned "connection not secure" each time and service-worker / popup
  // fetches failed outright. A stable cert fixes the whole session. Falls back
  // to plain http only if the cert files are missing (fresh clone).
  const certDir = path.resolve(__dirname, '.cert');
  const useHttps =
    fs.existsSync(path.join(certDir, 'localhost.pem')) &&
    fs.existsSync(path.join(certDir, 'localhost-key.pem'));

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: vendorChunk,
        },
      },
    },
    server: {
      host: true,
      port: 5174,
      hmr: true,
      ...(useHttps
        ? {
            https: {
              key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
              cert: fs.readFileSync(path.join(certDir, 'localhost.pem')),
            },
          }
        : {}),
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: 'ws://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
          secure: false,
          // No rewrite: the backend accepts upgrades only on /ws.
        },
      },
    },
  };
});