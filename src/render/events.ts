import { event as findEvent, resolveAge, unit } from '../data';
import { evenSpiralLength, type EvenSpiral } from '../geometry/spiral';
import { isMessageKey, t } from '../i18n/i18n';
import type { IllustrationKind } from './illustrations/icons';

/** What the 2D and 3D views share: which events get a picture, their wording, and the time spans. */

export interface EventMarker {
  id: string;
  art: IllustrationKind;
  ring: string;
}

/** Events on the main spiral (Big Bang → now). */
export const MAIN_EVENTS: EventMarker[] = [
  { id: 'big-bang', art: 'big-bang', ring: '#ffd166' },
  { id: 'solar-system', art: 'solar-system', ring: '#ffb347' },
  { id: 'first-life', art: 'first-life', ring: '#5fe3b1' },
];

/** Events inside the zoom lens (the Phanerozoic, 538.8 million years ago → now). */
export const LENS_EVENTS: EventMarker[] = [
  { id: 'animals-with-shells', art: 'trilobite', ring: '#9ad9dd' },
  { id: 'first-dinosaurs', art: 'herrerasaurus', ring: '#f4a261' },
  { id: 'last-dinosaurs', art: 'tyrannosaurus', ring: '#ff8a7a' },
  { id: 'first-people', art: 'people', ring: '#ffd166' },
];

/** Not an ICS colour: the time before the Earth existed. */
export const COSMOS_COLOR = '#3b2f8f';

/** The time spans of the main spiral (now → Big Bang) and of the zoom lens (the Phanerozoic), in years. */
export function timeSpans(): { main: number; lens: number; earth: number } {
  return {
    main: resolveAge(findEvent('big-bang')).years,
    lens: unit('Phanerozoic').begin.ma * 1e6,
    earth: unit('Hadean').begin.ma * 1e6,
  };
}

/**
 * How many times more path length one year gets inside the lens than on the main spiral, measured
 * on the honest top view (equal time = equal path length).
 */
export function zoomFactor(main: EvenSpiral, lens: EvenSpiral): number {
  const spans = timeSpans();
  return evenSpiralLength(lens) / spans.lens / (evenSpiralLength(main) / spans.main);
}

export function eventTitle(id: string): string {
  const key = `event.${id}.title`;
  return isMessageKey(key) ? t(key) : id;
}

export function eventLabel(id: string): string {
  const key = `event.${id}.label`;
  return isMessageKey(key) ? t(key) : eventTitle(id);
}

/**
 * Accessible name: the title and age, starting with the visible label when the title does not
 * already contain it, so voice control ("tap T. rex") finds the button.
 */
export function eventName(id: string, ago: string): string {
  const label = eventLabel(id);
  const title = eventTitle(id);
  const named = title.toLowerCase().includes(label.toLowerCase()) ? title : `${label}: ${title}`;
  return `${named}, ${ago}`;
}
