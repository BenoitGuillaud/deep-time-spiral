import eventsJson from './events.json';
import icsJson from './ics-units.json';
import type { AgeQualifier, DeepTimeEvent, IcsUnit, Source } from './types';
import { validateEvents, validateIcsData } from './validate';

export const ics = validateIcsData(icsJson);
export const events = validateEvents(eventsJson, ics);

const unitsById = new Map(ics.units.map((unit) => [unit.id, unit]));

export function unit(id: string): IcsUnit {
  const found = unitsById.get(id);
  if (!found) throw new Error(`Unknown ICS unit "${id}"`);
  return found;
}

/** Units of one rank, oldest first. */
export function unitsOfRank(rank: IcsUnit['rank']): IcsUnit[] {
  return ics.units.filter((u) => u.rank === rank).sort((a, b) => b.begin.ma - a.begin.ma);
}

export interface ResolvedAge {
  years: number;
  plusMinusYears: number | null;
  qualifier: AgeQualifier;
  source: Source;
}

const ICS_SOURCE = {
  citation: `International Commission on Stratigraphy (2026). International Chronostratigraphic Chart ${ics.chart.version}. Cohen, K., Harper, D., Gibbard, P., & Car, N. (2025). The ICS international chronostratigraphic chart this decade. Episodes, 48, 105–115.`,
  url: 'https://stratigraphy.org/chart',
  accessed: '2026-10-22',
} as const;

/** The age of an event in years, with its uncertainty and where it comes from. */
export function resolveAge(event: DeepTimeEvent): ResolvedAge {
  const { age } = event;
  if (age.kind === 'cited') return age;
  const boundary = unit(age.unit)[age.boundary];
  return {
    years: boundary.ma * 1e6,
    plusMinusYears: boundary.plusMinus === null ? null : boundary.plusMinus * 1e6,
    qualifier: boundary.uncertain || boundary.plusMinus !== null ? 'about' : 'exact',
    source: {
      ...ICS_SOURCE,
      detail: `${age.boundary === 'begin' ? 'Start' : 'End'} of the ${age.unit}: ${boundary.text} Ma${
        boundary.plusMinus === null ? '' : ` ± ${String(boundary.plusMinus)}`
      }.`,
    },
  };
}

export function event(id: string): DeepTimeEvent {
  const found = events.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown event "${id}"`);
  return found;
}
