import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// base './' so the app works from any folder (GitHub Pages, Netlify, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  // App version shown in the UI. Bump "version" in package.json for every release.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
