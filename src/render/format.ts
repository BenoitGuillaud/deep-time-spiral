import type { ResolvedAge } from '../data';
import { locale, t } from '../i18n/i18n';

/**
 * Kid-friendly "how long ago", rounded no further than the source allows: billions to one decimal,
 * millions to whole millions, then thousands or hundreds of years.
 */
export function formatAgo(age: Pick<ResolvedAge, 'years' | 'qualifier'>): string {
  const { years } = age;
  const number = (n: number, digits = 0): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);

  let text: string;
  if (years >= 1e9) {
    text = t('age.billion', { n: number(years / 1e9, 1) });
  } else if (years >= 1e6) {
    text = t('age.million', { n: number(Math.round(years / 1e6)) });
  } else if (years >= 1e5) {
    text = t('age.years', { n: number(Math.round(years / 1000) * 1000) });
  } else {
    text = t('age.years', { n: number(Math.round(years / 100) * 100) });
  }

  if (age.qualifier === 'about') return t('age.about', { age: text });
  if (age.qualifier === 'at-least') return t('age.atLeast', { age: text });
  return text;
}

/** A span of time such as "539 million years", for the zoom lens caption. */
export function formatSpanMillions(years: number): string {
  return t('age.span.million', {
    n: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(years / 1e6),
  });
}
