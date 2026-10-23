import { expect, test, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json' with { type: 'json' };

/** The 3D corkscrew (three.js). Browsers without WebGL must fall back to the 2D view. */

const STICKERS = 4;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * Opens the page in 3D and waits for it; skips the test where this browser has no WebGL at all.
 * ?view=3d forces 3D even on software WebGL (CI machines have no graphics chip); by default such
 * browsers get the 2D view.
 */
async function open3d(page: Page): Promise<string[]> {
  const errors = collectErrors(page);
  await page.goto('./?view=3d');
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  });
  if (!webgl) {
    // Without WebGL the 2D view must stay, fully working.
    await expect(page.locator('#app')).toHaveAttribute('data-view', '2d');
    await expect(page.locator('.stage-2d [role=button]')).toHaveCount(STICKERS);
    test.skip(true, 'This browser build has no WebGL; checked the 2D fallback instead.');
  }
  await expect(page.locator('#app')).toHaveAttribute('data-view', '3d');
  await expect(page.locator('.sticker-button')).toHaveCount(STICKERS);
  return errors;
}

const stage = (page: Page) => page.locator('.stage-3d');
const number = async (page: Page, name: 'distance' | 'azimuth'): Promise<number> =>
  Number(await stage(page).getAttribute(`data-${name}`));

test('upgrades to a 3D corkscrew that actually draws, without errors', async ({ page }) => {
  const errors = await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  // A blank canvas compresses to a few kilobytes; stars, ribbons and glows do not.
  const shot = await page.locator('canvas.vortex-canvas').screenshot();
  expect(shot.length).toBeGreaterThan(20_000);
  for (const name of ['The Big Bang', 'First life: The first living things', en['cluster.label']]) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}[,:]`) })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('tapping a picture flies the camera there and opens its card', async ({ page }) => {
  await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  const before = await number(page, 'distance');

  await page.locator('.sticker-button[data-event="first-life"]').click();
  await expect(stage(page)).toHaveAttribute('data-camera', 'first-life');
  expect(await number(page, 'distance')).toBeLessThan(before);
  const card = page.getByRole('dialog', { name: en['event.first-life.title'] });
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});

test('Home, Top, Side and 2D/3D buttons change the view', async ({ page }) => {
  await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');

  await page.getByRole('button', { name: en['view.top'] }).click();
  await expect(stage(page)).toHaveAttribute('data-camera', 'top');
  await page.getByRole('button', { name: en['view.side'] }).click();
  await expect(stage(page)).toHaveAttribute('data-camera', 'side');
  await page.getByRole('button', { name: en['view.home'] }).click();
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');

  await page.getByRole('button', { name: en['view.2d'], exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', '2d');
  await expect(page.locator('.stage-2d [role=button]')).toHaveCount(STICKERS);
  await page.getByRole('button', { name: en['view.3d'], exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', '3d');
});

/** A spot of empty sky near the bottom of the canvas, away from pictures and buttons. */
async function emptySky(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas.vortex-canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.85 };
}

// Mouse drag and wheel; touch spin and pinch use the same controls and are checked by hand on a tablet.
test('dragging spins the corkscrew', async ({ page }) => {
  await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  const { x, y } = await emptySky(page);
  const azimuth = await number(page, 'azimuth');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => number(page, 'azimuth')).not.toBeCloseTo(azimuth, 0);
  await expect(stage(page)).toHaveAttribute('data-camera', 'free');
});

test('with Move on, dragging slides the corkscrew instead of turning it', async ({ page }) => {
  await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  const move = page.getByRole('button', { name: en['view.move'], exact: true });
  await move.click();
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  const { x, y } = await emptySky(page);
  const azimuth = await number(page, 'azimuth');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y - 40, { steps: 8 });
  await page.mouse.up();
  await expect(stage(page)).toHaveAttribute('data-target', /./);
  expect(await number(page, 'azimuth')).toBeCloseTo(azimuth, 0);
  await move.click();
  await expect(move).toHaveAttribute('aria-pressed', 'false');
});

test('the mouse wheel zooms in', async ({ page, browserName, isMobile }) => {
  test.skip(
    browserName === 'webkit' && isMobile,
    'Playwright cannot send wheel events to mobile WebKit.',
  );
  await open3d(page);
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  const { x, y } = await emptySky(page);
  const distance = await number(page, 'distance');
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => number(page, 'distance')).toBeLessThan(distance);
});

test('with reduced motion, the camera jumps instead of flying', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open3d(page);
  // No lift-off from the top view: straight to Home.
  await expect(stage(page)).toHaveAttribute('data-camera', 'home');
  await page.getByRole('button', { name: en['view.top'] }).click();
  await expect(stage(page)).toHaveAttribute('data-camera', 'top', { timeout: 300 });
  const animation = await page
    .locator('.sticker-button')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

test('redraws without errors at many screen sizes and orientations', async ({ page }) => {
  const errors = await open3d(page);
  for (const [width, height] of [
    [412, 823],
    [823, 412],
    [768, 1024],
    [1024, 768],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.sticker-button')).toHaveCount(STICKERS);
  }
  expect(errors).toEqual([]);
});

test('without WebGL, stays on the 2D view', async ({ page }) => {
  await page.addInitScript(() => {
    // Pretend this browser has no WebGL: getContext('webgl'/'webgl2') returns null.
    const proto = HTMLCanvasElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'getContext')?.value as (
      ...args: unknown[]
    ) => unknown;
    Object.defineProperty(proto, 'getContext', {
      value(this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return type.startsWith('webgl') ? null : Reflect.apply(original, this, [type, ...rest]);
      },
    });
  });
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.locator('.stage-2d [role=button]')).toHaveCount(STICKERS);
  await page.waitForTimeout(2000);
  await expect(page.locator('#app')).toHaveAttribute('data-view', '2d');
  await expect(page.locator('.view-bar')).toBeHidden();
  expect(errors).toEqual([]);
});
