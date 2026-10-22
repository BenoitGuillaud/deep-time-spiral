import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site under /deep-time-spiral/; Vercel and local dev serve it at /.
  base: process.env.VITE_BASE || '/',
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
