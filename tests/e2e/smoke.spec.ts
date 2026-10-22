import { expect, test } from '@playwright/test';
import en from '../../src/i18n/en.json' with { type: 'json' };

test('shows the hello spiral without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');

  await expect(page).toHaveTitle(en['app.title']);
  await expect(page.getByRole('heading', { level: 1, name: en['app.title'] })).toBeVisible();
  await expect(page.getByRole('img', { name: en['spiral.label'] })).toBeVisible();
  await expect(page.getByText(en['spiral.now'], { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('fits the screen without sideways scrolling', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('img', { name: en['spiral.label'] })).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('turns animations off when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const animations = await page.evaluate(() =>
    ['.spiral-path', '.now-glow'].map((selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).animationName : 'missing';
    }),
  );
  expect(animations).toEqual(['none', 'none']);
});
