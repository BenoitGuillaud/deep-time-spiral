import { defineConfig, devices } from '@playwright/test';

// Own port, so a preview server already running on Vite's default 4173 is never reused by mistake.
const PORT = 4174;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}/`,
    trace: 'on-first-retry',
  },
  // Tablet-first, phone-ready: each engine on one tablet and one phone.
  projects: [
    { name: 'chromium-tablet', use: { ...devices['Galaxy Tab S9'] } },
    { name: 'webkit-tablet', use: { ...devices['iPad (gen 11)'] } },
    { name: 'chromium-phone', use: { ...devices['Pixel 9'] } },
    { name: 'webkit-phone', use: { ...devices['iPhone 17'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: !CI,
  },
});
