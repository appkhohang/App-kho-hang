import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // Respect Repo Name if building on GitHub Actions for GH Pages.
  // This avoids blank screens on GitHub Pages by ensuring assets are loaded correctly
  // even when visited without a trailing slash (e.g. /repository-name).
  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
  const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
  
  // Use VITE_BASE_URL if explicitly defined, otherwise use absolute repo path for GitHub Actions.
  // We default to relative paths './' to guarantee full mobility across subdirectories and local builds.
  const base = process.env.VITE_BASE_URL || (isGithubActions ? `/${repoName}/` : './');

  return {
    base: base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
