import { unit, unitsOfRank } from '../data';
import type { IcsRank } from '../data/types';
import { COSMOS_COLOR } from './events';

/**
 * Which colour each stretch of the corkscrew gets, for a given time span (Now → `spanYears` ago).
 * Positions are fractions of the path (0 = Now, 1 = the oldest time shown), true to scale.
 */
export interface Band {
  from: number;
  to: number;
  color: string;
  /** ICS unit id, or null for the time before the Earth (not an ICS unit). */
  unitId: string | null;
}

/**
 * The finest ICS rank that still shows a few distinct colours for this span: epochs for human
 * times, periods up to the shelled animals, eons beyond.
 */
export function rankForSpan(spanYears: number): IcsRank {
  if (spanYears <= 3e6) return 'epoch';
  if (spanYears <= 7e8) return 'period';
  return 'eon';
}

export function spanBands(spanYears: number): Band[] {
  if (!(spanYears > 0 && Number.isFinite(spanYears))) {
    throw new RangeError(`Span must be a positive number of years, got ${String(spanYears)}`);
  }
  const earth = unit('Hadean').begin.ma * 1e6;
  const bands: Band[] = [];
  // Youngest first, from Now outward.
  const units = unitsOfRank(rankForSpan(spanYears)).reverse();
  for (const u of units) {
    const young = u.end.ma * 1e6;
    const old = u.begin.ma * 1e6;
    if (young >= spanYears) break;
    bands.push({
      from: young / spanYears,
      to: Math.min(old, spanYears) / spanYears,
      color: u.color,
      unitId: u.id,
    });
  }
  if (spanYears > earth)
    bands.push({ from: earth / spanYears, to: 1, color: COSMOS_COLOR, unitId: null });
  return bands;
}

/** The band colour at fraction f of the path (binary search; bands are contiguous). */
export function colourAt(bands: Band[], f: number): string {
  let lo = 0;
  let hi = bands.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((bands[mid]?.to ?? 1) < f) lo = mid + 1;
    else hi = mid;
  }
  return bands[lo]?.color ?? COSMOS_COLOR;
}
