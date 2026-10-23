import { expect, test, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json' with { type: 'json' };

/** People & dinosaurs (one cluster flag next to Now), first life, the Sun and Earth, the Big Bang. */
const EVENT_COUNT = 4;

/** The 2D corkscrew (also the fallback without WebGL). The 3D view has its own tests in spiral-3d.spec.ts. */
async function openSpiral(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?view=2d');
  await expect(page.locator('.stage-2d [role=button]')).toHaveCount(EVENT_COUNT);
  return errors;
}

test('shows the corkscrew and every flag without errors', async ({ page }) => {
  const errors = await openSpiral(page);

  await expect(page).toHaveTitle(en['app.title']);
  await expect(page.getByRole('heading', { level: 1, name: en['app.title'] })).toBeVisible();
  await expect(page.getByRole('group', { name: en['spiral.label'] })).toBeVisible();
  await expect(page.getByText(en['spiral.you'], { exact: true })).toBeVisible();
  for (const name of ['The Big Bang', 'First life: The first living things', en['cluster.label']]) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}[,:]`) })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: en['app.credits'] })).toHaveAttribute(
    'href',
    /CREDITS\.md$/,
  );
  expect(errors).toEqual([]);
});

test('opens a card with the age and its source when a picture is tapped', async ({ page }) => {
  await openSpiral(page);

  await page.getByRole('button', { name: /^The Sun and Earth are born,/ }).click();
  const card = page.getByRole('dialog', { name: en['event.solar-system.title'] });
  await expect(card).toBeVisible();
  await expect(card.getByText('about 4.6 billion years ago', { exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: en['card.source'] })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});

test('the flag next to Now says people and dinosaurs are all squeezed in there', async ({
  page,
}) => {
  await openSpiral(page);

  await page.getByRole('button', { name: new RegExp(`^${en['cluster.label']}:`) }).click();
  const card = page.getByRole('dialog', { name: en['cluster.title'] });
  await expect(card.getByText('All in the last 539 million years')).toBeVisible();
  await expect(card.getByText(/T\. rex/)).toBeVisible();
  // A group of events has no single source; each one's own card cites it.
  await expect(card.getByRole('link', { name: en['card.source'] })).toBeHidden();
});

test('works with the keyboard', async ({ page }) => {
  await openSpiral(page);

  await page.getByRole('button', { name: /^The Big Bang,/ }).focus();
  await page.keyboard.press('Enter');
  const card = page.getByRole('dialog', { name: en['event.big-bang.title'] });
  await expect(card.getByText('about 13.8 billion years ago')).toBeVisible();
  await card.getByRole('button', { name: en['card.close'] }).click();
  await expect(card).toBeHidden();
});

test('keeps every label on screen and every picture big enough to tap', async ({ page }) => {
  await openSpiral(page);
  // Measure the final layout, after the pictures have finished popping in (twinkles never end).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');

  for (const label of await page.locator('.event-label').all()) {
    const box = await label.boundingBox();
    expect(box, (await label.textContent()) ?? '').not.toBeNull();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  for (const button of await page.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
});

test('redraws without errors at many screen sizes', async ({ page }) => {
  const errors = await openSpiral(page);
  for (const [width, height] of [
    [412, 823],
    [360, 640],
    [375, 667],
    [430, 932],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1366, 768],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.stage-2d [role=button]')).toHaveCount(EVENT_COUNT);
  }
  expect(errors).toEqual([]);
});

test('fits the screen without sideways scrolling', async ({ page }) => {
  await openSpiral(page);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('turns animations off when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSpiral(page);

  const animated = await page.evaluate(() =>
    ['.seg', '.pop', '.twinkle', '.pulse'].map((selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).animationName : 'missing';
    }),
  );
  expect(animated).toEqual(['none', 'none', 'none', 'none']);
});
