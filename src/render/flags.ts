import { event as findEvent, resolveAge } from '../data';
import { t } from '../i18n/i18n';
import { EVENTS, eventLabel, eventName, type EventMarker } from './events';
import { formatAgo, formatSpan } from './format';
import type { IllustrationKind } from './illustrations/icons';

/**
 * Which flags stand on the corkscrew for a time span. Events crowded into the last few percent of
 * the span (all near Now, true to scale) share one "zoom in" flag instead of piling up.
 */

/** Events younger than this share of the span count as "near Now". */
export const NEAR_NOW = 0.05;

export type Flag =
  | { kind: 'event'; marker: EventMarker; years: number; f: number }
  | { kind: 'cluster'; members: EventMarker[]; years: number; f: 0 };

export function flagsForSpan(spanYears: number): Flag[] {
  const inside = EVENTS.map((marker) => ({ marker, years: resolveAge(findEvent(marker.id)).years }))
    .filter((e) => e.years <= spanYears)
    .sort((a, b) => a.years - b.years);
  const near = inside.filter((e) => e.years / spanYears < NEAR_NOW);
  const flags: Flag[] = [];
  if (near.length >= 2) {
    flags.push({
      kind: 'cluster',
      members: near.map((e) => e.marker),
      // The cluster covers everything from Now back to its oldest member.
      years: Math.max(...near.map((e) => e.years)),
      f: 0,
    });
  }
  for (const e of inside) {
    if (near.length >= 2 && near.includes(e)) continue;
    flags.push({ kind: 'event', marker: e.marker, years: e.years, f: e.years / spanYears });
  }
  return flags;
}

export interface FlagLook {
  /** `data-event` value: the event id, or "cluster". */
  id: string;
  art: IllustrationKind;
  ring: string;
  /** Short visible label. */
  label: string;
  /** Accessible name: starts with the visible label, then says how long ago. */
  name: string;
}

/** How a flag looks and is announced, the same in the 2D and 3D views. */
export function flagLook(flag: Flag): FlagLook {
  if (flag.kind === 'cluster') {
    const label = t('cluster.label');
    return {
      id: 'cluster',
      art: 'zoom',
      ring: '#ffd166',
      label,
      name: `${label}: ${t('cluster.age', { span: formatSpan(flag.years) })}`,
    };
  }
  const { marker } = flag;
  return {
    id: marker.id,
    art: marker.art,
    ring: marker.ring,
    label: eventLabel(marker.id),
    name: eventName(marker.id, formatAgo(resolveAge(findEvent(marker.id)))),
  };
}
