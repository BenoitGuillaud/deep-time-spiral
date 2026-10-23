import {
  ICS_RANKS,
  LOCALES,
  type DeepTimeEvent,
  type IcsBoundary,
  type IcsData,
  type IcsUnit,
  type Source,
} from './types';

/** Runtime checks for the JSON data files, so a malformed edit fails loudly. */

class DataError extends Error {
  override name = 'DataError';
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new DataError(message);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function checkBoundary(value: unknown, where: string): asserts value is IcsBoundary {
  check(isRecord(value), `${where}: boundary must be an object`);
  check(isNumber(value.ma) && value.ma >= 0, `${where}: bad age`);
  check(isText(value.text) && Number(value.text) === value.ma, `${where}: text must match age`);
  check(
    value.plusMinus === null || (isNumber(value.plusMinus) && value.plusMinus > 0),
    `${where}: bad ±`,
  );
  check(typeof value.uncertain === 'boolean', `${where}: uncertain must be true or false`);
}

function checkUnit(value: unknown, i: number): asserts value is IcsUnit {
  const where = `ics-units.json unit ${String(i)}`;
  check(isRecord(value), `${where}: must be an object`);
  check(isText(value.id), `${where}: missing id`);
  check((ICS_RANKS as readonly unknown[]).includes(value.rank), `${value.id}: unknown rank`);
  check(value.parent === null || isText(value.parent), `${value.id}: bad parent`);
  check(isNumber(value.order), `${value.id}: bad order`);
  check(isText(value.notation), `${value.id}: missing notation`);
  check(
    typeof value.color === 'string' && /^#[0-9A-F]{6}$/.test(value.color),
    `${value.id}: bad colour`,
  );
  checkBoundary(value.begin, `${value.id} begin`);
  checkBoundary(value.end, `${value.id} end`);
  const { labels } = value;
  check(
    labels === null || (isRecord(labels) && LOCALES.every((locale) => isText(labels[locale]))),
    `${value.id}: labels must be null or cover ${LOCALES.join(', ')}`,
  );
}

export function validateIcsData(value: unknown): IcsData {
  check(isRecord(value), 'ics-units.json must be an object');
  const { chart, units } = value;
  check(
    isRecord(chart) && isText(chart.version) && isText(chart.source),
    'ics-units.json: bad chart info',
  );
  check(Array.isArray(units) && units.length > 0, 'ics-units.json: no units');
  units.forEach(checkUnit);
  return value as unknown as IcsData;
}

function checkSource(value: unknown, where: string): asserts value is Source {
  check(isRecord(value), `${where}: every non-ICS age needs a source`);
  check(isText(value.citation), `${where}: source needs a citation`);
  check(isText(value.url) && /^https:\/\//.test(value.url), `${where}: source needs an https URL`);
  check(isText(value.detail), `${where}: source needs a detail saying where the number is`);
  check(
    isText(value.accessed) && /^\d{4}-\d{2}-\d{2}$/.test(value.accessed),
    `${where}: bad accessed date`,
  );
}

export function validateEvents(value: unknown, ics: IcsData): DeepTimeEvent[] {
  check(Array.isArray(value), 'events.json must be a list');
  const ids = new Set<string>();
  value.forEach((event: unknown, i) => {
    check(isRecord(event) && isText(event.id), `events.json item ${String(i)}: missing id`);
    check(!ids.has(event.id), `${event.id}: duplicate id`);
    ids.add(event.id);
    const { age } = event;
    check(isRecord(age), `${event.id}: missing age`);
    if (age.kind === 'ics') {
      check(
        ics.units.some((unit) => unit.id === age.unit),
        `${event.id}: unknown ICS unit ${String(age.unit)}`,
      );
      check(age.boundary === 'begin' || age.boundary === 'end', `${event.id}: bad boundary`);
    } else {
      check(age.kind === 'cited', `${event.id}: age kind must be "cited" or "ics"`);
      check(isNumber(age.years) && age.years > 0, `${event.id}: bad age in years`);
      check(
        age.plusMinusYears === null || (isNumber(age.plusMinusYears) && age.plusMinusYears > 0),
        `${event.id}: bad ±`,
      );
      check(
        ['about', 'at-least', 'exact'].includes(String(age.qualifier)),
        `${event.id}: bad qualifier`,
      );
      checkSource(age.source, event.id);
    }
  });
  return value as DeepTimeEvent[];
}
