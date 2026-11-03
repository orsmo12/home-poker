import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// A view-only link (?view=TOKEN or #snap=...) opens the read-only viewer, which never
// touches this device's saved games.
const isViewer = /[?&]view=/.test(window.location.search) || window.location.hash.startsWith('#snap=');
const Root = isViewer ? React.lazy(() => import('./screens/ViewerApp')) : App;
import { initAnalytics } from './lib/analytics';

initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={null}><Root /></React.Suspense>
  </React.StrictMode>
);

// PWA: register the service worker (production builds only, so dev reloads stay fresh).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
  });
}
