import type { ResolvedAge } from '../data';
import { locale, t, type MessageKey } from '../i18n/i18n';

/**
 * Kid-friendly "how long ago", rounded no further than the source allows: billions to one decimal,
 * millions to whole millions, then thousands or hundreds of years. Built in steps (amount, then
 * "about" / "at least", then "ago") because languages put them in different orders.
 */
export function formatAgo(age: Pick<ResolvedAge, 'years' | 'qualifier'>): string {
  const text = amount(age.years, 'age.billion', 'age.million', 'age.years');
  const qualified =
    age.qualifier === 'about'
      ? t('age.about', { amount: text })
      : age.qualifier === 'at-least'
        ? t('age.atLeast', { amount: text })
        : text;
  return t('age.ago', { amount: qualified });
}

/** A span of time such as "539 million years" or "13.8 billion years", rounded like `formatAgo`. */
export function formatSpan(years: number): string {
  return amount(years, 'age.span.billion', 'age.span.million', 'age.span.years');
}

function amount(
  years: number,
  billion: MessageKey,
  million: MessageKey,
  plain: MessageKey,
): string {
  // The count picks singular or plural words ("1,8 milliard", "4,6 milliards").
  const say = (key: MessageKey, n: number, digits = 0): string => {
    const rounded = Number(n.toFixed(digits));
    const shown = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(rounded);
    return t(key, { n: shown }, rounded);
  };
  if (years >= 1e9) return say(billion, years / 1e9, 1);
  if (years >= 1e6) return say(million, Math.round(years / 1e6));
  if (years >= 1e5) return say(plain, Math.round(years / 1000) * 1000);
  return say(plain, Math.round(years / 100) * 100);
}
