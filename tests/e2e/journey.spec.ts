import { expect, test, type Page } from '@playwright/test';
import de from '../../src/i18n/de.json' with { type: 'json' };
import en from '../../src/i18n/en.json' with { type: 'json' };
import fr from '../../src/i18n/fr.json' with { type: 'json' };
import hu from '../../src/i18n/hu.json' with { type: 'json' };
import { installFakeVoice, interruptions, spoken } from './fake-voice';

/**
 * The start screen and the landing journey: Now → the Big Bang, one picture at a time, with
 * captions beside it, read aloud slowly, in four languages.
 */

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

async function start(page: Page, query: string, startLabel = en['start.button']): Promise<void> {
  await page.goto(`./?${query}`);
  await page.getByRole('button', { name: startLabel }).click();
}

test('the start screen offers the four languages, in their own names', async ({ page }) => {
  await installFakeVoice(page);
  await page.goto('./?view=2d');
  const languages = page.getByRole('group', { name: en['language.label'] }).first();
  for (const name of ['English', 'Français', 'Deutsch', 'Magyar']) {
    await expect(languages.getByRole('button', { name })).toBeVisible();
  }
  await expect(languages.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.view-bar')).toBeHidden();

  // Choosing a language reloads the page in it.
  await languages.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(de['app.title']);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('button', { name: de['start.button'] })).toBeVisible();
});

test('plays stop by stop, reading every caption aloud slowly, and ends on the whole spiral', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await installFakeVoice(page);
  const captions = await recordCaptions(page);
  // 12× faster than for real; the 2D view, so every browser in CI can draw it.
  await start(page, 'view=2d&journey=fast');
  await expect(page.locator('.view-bar')).toBeHidden();
  await expect(panel(page)).toBeHidden({ timeout: 20_000 });

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

  const words = await spoken(page);
  expect(words[0]).toEqual({ text: 'This is now.', lang: 'en-GB', rate: 0.8 });
  expect(words.map((w) => w.text).join(' ')).toContain('The Big Bang.');
  expect(words.every((w) => w.rate === 0.8)).toBe(true);
  await expect(page.getByRole('button', { name: en['journey.play'] })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the spark waits for the voice: nothing is cut off', async ({ page }) => {
  // A very slow voice (40 ms a letter) on the 12× journey: without waiting, it would be cut off.
  await installFakeVoice(page, { msPerChar: 40 });
  await start(page, 'view=2d&journey=fast');
  await expect(caption(page)).toContainText(en['cluster.title'], { timeout: 10_000 });
  // The cluster stop lasts 0.4 s at this speed, but its words take several seconds.
  await page.waitForTimeout(1500);
  await expect(caption(page)).toContainText(en['cluster.title']);
  expect(await interruptions(page)).toBe(0);
});

test.describe('in other languages', () => {
  for (const [lang, catalog] of [
    ['fr', fr],
    ['de', de],
    ['hu', hu],
  ] as const) {
    test(`${lang}: the journey and its voice`, async ({ page }) => {
      await installFakeVoice(page);
      const captions = await recordCaptions(page);
      await start(page, `lang=${lang}&view=2d&journey=fast`, catalog['start.button']);
      await expect(panel(page)).toBeHidden({ timeout: 20_000 });
      const seen = await captions();
      expect(seen[0]).toBe(catalog['journey.now']);
      expect(seen).toContain(catalog['event.big-bang.title']);
      const words = await spoken(page);
      expect(words.length).toBeGreaterThan(10);
      expect(words.every((w) => w.lang.startsWith(lang))).toBe(true);
    });
  }
});

test('Skip stops the voice and jumps to the end; Journey plays it again', async ({ page }) => {
  await installFakeVoice(page, { msPerChar: 40 });
  await start(page, 'view=2d');
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

test('cards read themselves aloud, and the voice button silences them', async ({ page }) => {
  await installFakeVoice(page);
  await page.goto('./?view=2d&journey=0');
  await page.getByRole('button', { name: /^First life:/ }).click();
  const card = page.getByRole('dialog', { name: en['event.first-life.title'] });
  await expect(card).toBeVisible();
  await expect
    .poll(async () => (await spoken(page)).map((w) => w.text))
    .toContain('The first living things.');
  await card.getByRole('button', { name: en['card.listen'] }).click();
  await page.keyboard.press('Escape');

  const before = (await spoken(page)).length;
  const voice = page.getByRole('button', { name: en['voice.toggle'] });
  await expect(voice).toHaveAttribute('aria-pressed', 'true');
  await voice.click();
  await expect(voice).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /^The Big Bang,/ }).click();
  await expect(page.getByRole('dialog', { name: en['event.big-bang.title'] })).toBeVisible();
  expect((await spoken(page)).length).toBe(before);
});

test('without a voice for the language, the text still shows and the speaker greys out', async ({
  page,
}) => {
  await installFakeVoice(page, { languages: ['en-GB'] });
  await start(page, 'lang=hu&view=2d&journey=fast', hu['start.button']);
  await expect(panel(page)).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: hu['voice.toggle'] })).toBeDisabled();
  expect(await spoken(page)).toEqual([]);
});

test('with reduced motion, the child steps through with Next', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFakeVoice(page);
  await start(page, 'view=2d');
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
  await installFakeVoice(page);
  await page.goto('./?view=3d&journey=fast');
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  });
  test.skip(!webgl, 'This browser build has no WebGL.');
  // Start once the 3D view is there, so the whole journey is in 3D.
  await expect(page.locator('#app')).toHaveAttribute('data-view', '3d', { timeout: 10_000 });
  await page.getByRole('button', { name: en['start.button'] }).click();
  const stage = page.locator('.stage-3d');
  await expect(stage).toHaveAttribute('data-camera', 'journey', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-camera', 'home', { timeout: 20_000 });
  await expect(page.locator('.sticker-button')).toHaveCount(4);
  await expect(page.locator('.sticker.waiting')).toHaveCount(0);
  await expect(page.getByRole('button', { name: en['view.top'] })).toBeVisible();
  expect(errors).toEqual([]);
});
