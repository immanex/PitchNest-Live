import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { API_BASE_URL } from './lib/apiBase.ts';

// Automatically route relative /api calls to the backend on hosted environments
const API_URL = API_BASE_URL;

const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0';

if (!isLocalhost && API_URL) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string') {
      if (input.startsWith('/api')) {
        input = `${API_URL}${input}`;
      }
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/api')) {
        input = new URL(`${API_URL}${input.pathname}${input.search}`);
      }
    } else if (input instanceof Request) {
      try {
        const u = new URL(input.url);
        if (u.pathname.startsWith('/api') && (u.origin === window.location.origin || input.url.startsWith('/api'))) {
          input = new Request(`${API_URL}${u.pathname}${u.search}`, input);
        }
      } catch {
        if (input.url.startsWith('/api')) {
          input = new Request(`${API_URL}${input.url}`, input);
        }
      }
    }
    return originalFetch.call(this, input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <App />
);
