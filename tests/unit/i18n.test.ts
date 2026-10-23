import { afterEach, describe, expect, it, vi } from 'vitest';
import { event, resolveAge } from '../../src/data';
import { LOCALES } from '../../src/data/types';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';
import fr from '../../src/i18n/fr.json';
import hu from '../../src/i18n/hu.json';
import { chooseLocale } from '../../src/i18n/i18n';

const catalogs: Record<string, Record<string, string>> = { en, fr, de, hu };
const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('translations', () => {
  it.each(LOCALES)('%s has every English key, with the same placeholders', (code) => {
    const catalog = catalogs[code] ?? {};
    for (const [key, text] of Object.entries(en)) {
      expect(catalog[key], `${code}: ${key}`).toBeTypeOf('string');
      expect(placeholders(catalog[key] ?? ''), `${code}: ${key}`).toEqual(placeholders(text));
    }
  });

  it.each(LOCALES)('%s has no stray keys (only singular forms of real keys)', (code) => {
    for (const key of Object.keys(catalogs[code] ?? {})) {
      expect(key in en || (key.endsWith('.one') && key.slice(0, -4) in en), `${code}: ${key}`).toBe(
        true,
      );
    }
  });
});

describe('chooseLocale', () => {
  it('takes the address first, then the saved choice, then the browser, then English', () => {
    expect(chooseLocale('hu', 'fr', ['de-DE'])).toBe('hu');
    expect(chooseLocale(null, 'fr', ['de-DE'])).toBe('fr');
    expect(chooseLocale('xx', null, ['es-ES', 'de-AT', 'fr'])).toBe('de');
    expect(chooseLocale(null, null, ['es'])).toBe('en');
  });
});

/** The formatting functions as they work in another language (the language is set at load). */
async function formatIn(lang: string) {
  vi.resetModules();
  vi.stubGlobal('window', {
    location: { search: `?lang=${lang}` },
    localStorage: { getItem: () => null },
    navigator: { languages: [] },
  });
  return import('../../src/render/format');
}

describe('ages in every language', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['en', 'about 13.8 billion years ago', '1.8 billion years', '66 million years ago'],
    [
      'fr',
      'il y a environ 13,8 milliards d’années',
      '1,8 milliard d’années',
      'il y a 66 millions d’années',
    ],
    ['de', 'vor etwa 13,8 Milliarden Jahren', '1,8 Milliarden Jahre', 'vor 66 Millionen Jahren'],
    ['hu', 'körülbelül 13,8 milliárd évvel ezelőtt', '1,8 milliárd év', '66 millió évvel ezelőtt'],
  ])('%s', async (lang, bigBang, turn, dinosaurs) => {
    const { formatAgo, formatSpan } = await formatIn(lang);
    // Typographic apostrophes in the expectations are normalised to the catalogs' plain ones.
    const plain = (s: string) => s.replaceAll('’', "'");
    expect(formatAgo(resolveAge(event('big-bang')))).toBe(plain(bigBang));
    expect(formatSpan(1.8e9)).toBe(plain(turn));
    expect(formatAgo(resolveAge(event('last-dinosaurs')))).toBe(plain(dinosaurs));
  });

  it('uses the singular where the language needs it', async () => {
    const fr = await formatIn('fr');
    expect(fr.formatSpan(1.8e9)).toBe("1,8 milliard d'années");
    expect(fr.formatSpan(4.6e9)).toBe("4,6 milliards d'années");
    const de = await formatIn('de');
    expect(de.formatSpan(1e9)).toBe('1 Milliarde Jahre');
  });
});
