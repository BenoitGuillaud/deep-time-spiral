import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site under /deep-time-spiral/; Vercel and local dev serve it at /.
  base: process.env.VITE_BASE || '/',
  build: {
    // The three.js chunk (~580 kB, ~145 kB gzipped) is loaded lazily after the 2D view; that is expected.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
