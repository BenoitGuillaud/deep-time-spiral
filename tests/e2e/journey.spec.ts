import { expect, test, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json' with { type: 'json' };

/** The landing journey: Now → the Big Bang, one picture at a time, with captions beside it. */

const panel = (page: Page) => page.locator('.journey-panel');
const caption = (page: Page) => page.locator('.journey-words');

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Records the title (or text) of every caption the page shows, however briefly. */
async function recordCaptions(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { seenCaptions: seen });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains('journey-caption')) {
            seen.push(node.firstElementChild?.textContent ?? '');
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { seenCaptions: string[] }).seenCaptions);
}

test('plays on landing, stop by stop, and ends on the whole spiral', async ({ page }) => {
  const errors = collectErrors(page);
  const captions = await recordCaptions(page);
  // 12× faster than for real; the 2D view, so every browser in CI can draw it.
  await page.goto('./?view=2d&journey=fast');
  // (At this speed each caption lasts a fraction of a second: they are checked from the record.)
  await expect(page.locator('.view-bar')).toBeHidden();
  await expect(panel(page)).toBeHidden({ timeout: 15_000 });
  const seen = await captions();
  expect(seen[0]).toBe(en['journey.now']);
  expect(seen).toEqual(
    expect.arrayContaining([
      en['cluster.title'],
      en['journey.turn.title'],
      en['event.first-life.title'],
      en['event.solar-system.title'],
      en['journey.cosmos.1'],
      en['event.big-bang.title'],
    ]),
  );
  expect(seen.indexOf(en['event.first-life.title'])).toBeLessThan(
    seen.indexOf(en['event.solar-system.title']),
  );
  expect(seen.at(-1)).toBe(en['journey.end']);
  await expect(page.getByRole('button', { name: en['journey.play'] })).toBeVisible();
  await expect(page.locator('.stage-2d [role=button]')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('Skip jumps to the end, and the Journey button plays it again', async ({ page }) => {
  await page.goto('./?view=2d');
  await expect(caption(page)).toContainText(en['journey.now']);
  await page.getByRole('button', { name: en['journey.skip'] }).click();
  await expect(panel(page)).toBeHidden();
  const replay = page.getByRole('button', { name: en['journey.play'] });
  await expect(replay).toBeVisible();

  await replay.click();
  await expect(panel(page)).toBeVisible();
  await expect(caption(page)).toContainText(en['journey.now']);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
});

test('with reduced motion, the child steps through with Next', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?view=2d');
  await expect(caption(page)).toContainText(en['journey.now']);
  const next = page.getByRole('button', { name: en['journey.next'] });
  await next.click();
  await expect(caption(page)).toContainText(en['cluster.title']);
  // Everything is already drawn: no movement to wait for.
  await expect(page.locator('.stage-2d [role=button]')).toHaveCount(4);
  for (let i = 0; i < 30; i++) {
    if ((await caption(page).textContent())?.includes(en['journey.end'])) break;
    await next.click();
  }
  await expect(caption(page)).toContainText(en['journey.end']);
  await next.click();
  await expect(panel(page)).toBeHidden();
});

test('in 3D, the camera travels and every picture appears by the end', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?view=3d&journey=fast');
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  });
  test.skip(!webgl, 'This browser build has no WebGL.');
  const stage = page.locator('.stage-3d');
  await expect(stage).toHaveAttribute('data-camera', 'journey', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-camera', 'home', { timeout: 15_000 });
  await expect(page.locator('.sticker-button')).toHaveCount(4);
  await expect(page.locator('.sticker.waiting')).toHaveCount(0);
  await expect(page.getByRole('button', { name: en['view.top'] })).toBeVisible();
  expect(errors).toEqual([]);
});
