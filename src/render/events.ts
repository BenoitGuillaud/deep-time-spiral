import { isMessageKey, t } from '../i18n/i18n';
import type { IllustrationKind } from './illustrations/icons';

/** What the 2D and 3D views share: which events get a picture, and their wording. */

export interface EventMarker {
  id: string;
  art: IllustrationKind;
  ring: string;
}

/** Every event with a picture, newest first. */
export const EVENTS: EventMarker[] = [
  { id: 'first-people', art: 'people', ring: '#ffd166' },
  { id: 'last-dinosaurs', art: 'tyrannosaurus', ring: '#ff8a7a' },
  { id: 'first-dinosaurs', art: 'herrerasaurus', ring: '#f4a261' },
  { id: 'animals-with-shells', art: 'trilobite', ring: '#9ad9dd' },
  { id: 'first-life', art: 'first-life', ring: '#5fe3b1' },
  { id: 'solar-system', art: 'solar-system', ring: '#ffb347' },
  { id: 'big-bang', art: 'big-bang', ring: '#ffd166' },
];

/** How far left of the Now glow (world units) the "You are here" label ends. */
export const YOU_GAP = 0.1;

/** Not an ICS colour: the time before the Earth existed. */
export const COSMOS_COLOR = '#3b2f8f';

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
