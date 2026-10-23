import { LOCALES, type Locale } from '../data/types';
import de from './de.json';
import en from './en.json';
import fr from './fr.json';
import hu from './hu.json';

/**
 * UI strings in English, French, German and Hungarian. The language is chosen once, when the page
 * loads; switching reloads the page in the new language, so every view is simply rebuilt.
 */

export type MessageKey = keyof typeof en;

/** A key may also have a `<key>.one` form, used when the count is singular in that language. */
const CATALOGS: Record<Locale, Record<string, string>> = { en, fr, de, hu };

/** Each language in its own name, for the language buttons. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  hu: 'Magyar',
};

const STORAGE_KEY = 'deep-time-spiral.lang';

const isLocale = (value: string | null | undefined): value is Locale =>
  (LOCALES as readonly string[]).includes(value ?? '');

/**
 * The language to use: the address (`?lang=fr`), then the one chosen last time, then the browser's
 * preferred languages, then English.
 */
export function chooseLocale(
  requested: string | null,
  saved: string | null,
  preferred: readonly string[],
): Locale {
  if (isLocale(requested)) return requested;
  if (isLocale(saved)) return saved;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

function savedLocale(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private browsing or blocked storage: just don't remember
  }
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en'; // unit tests
  return chooseLocale(
    new URLSearchParams(window.location.search).get('lang'),
    savedLocale(),
    window.navigator.languages,
  );
}

export const locale: Locale = detectLocale();
const messages = CATALOGS[locale];
const plurals = new Intl.PluralRules(locale);

/**
 * Looks up a UI string and fills in `{name}` placeholders. With a `count`, a singular form
 * (`<key>.one`) is used where the language has one: "1,8 milliard" but "4,6 milliards".
 */
export function t(key: MessageKey, params: Record<string, string> = {}, count?: number): string {
  const singular =
    count !== undefined && plurals.select(count) === 'one' ? messages[`${key}.one`] : undefined;
  const text = singular ?? messages[key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

/** True if the key exists, for keys built at runtime such as `event.<id>.title`. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key);
}

/** Remembers the language and reloads the page in it. */
export function switchLocale(next: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not remembered; the address still carries it.
  }
  const url = new URL(window.location.href);
  url.searchParams.set('lang', next);
  window.location.assign(url);
}
