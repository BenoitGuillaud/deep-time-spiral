import type { Locale } from '../data/types';

/**
 * Read-aloud with the browser's own voices (`speechSynthesis`), slowly, for children who may not
 * read yet. Where a language has no voice, the text still shows and the speaker button greys out.
 */

/** Speaking rate: a little slower than normal speech. */
export const RATE = 0.8;
const PITCH = 1.05;
const STORAGE_KEY = 'deep-time-spiral.voice';

/** The parts of a `SpeechSynthesisVoice` that matter for choosing one. */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

// Joke and robotic voices that come with macOS: never use them for a child's story.
const NOVELTY =
  /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Eddy|Flo|Fred|Good News|Grandma|Grandpa|Jester|Junior|Kathy|Organ|Ralph|Reed|Rocko|Sandy|Shelley|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
const NATURAL = /(enhanced|premium|natural|neural|siri)/i;

/** The language's home region: France French before Canadian French, and so on. */
const REGIONS: Record<Locale, readonly string[]> = {
  en: ['en-gb', 'en-us'],
  fr: ['fr-fr'],
  de: ['de-de'],
  hu: ['hu-hu'],
};

/** Clear, well-known voices (Apple, Microsoft, Google), best first. */
const KNOWN: Record<Locale, readonly string[]> = {
  en: ['Samantha', 'Daniel', 'Karen', 'Moira', 'Google UK English Female', 'Google US English'],
  fr: ['Thomas', 'Amélie', 'Audrey', 'Aurélie', 'Google français'],
  de: ['Anna', 'Helena', 'Petra', 'Markus', 'Google Deutsch'],
  hu: ['Tünde', 'Mariska', 'Noémi', 'Google magyar'],
};

/**
 * The best voice for a language: the right language first, then voices that sound natural, then
 * well-known clear ones from the language's home region, on the device (they start at once and
 * work offline). Never a joke voice. Null if there is none.
 */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], locale: Locale): V | null {
  const tag = (v: V): string => v.lang.toLowerCase().replace('_', '-');
  const score = (v: V): number => {
    const known = KNOWN[locale].findIndex((name) => v.name.startsWith(name));
    return (
      (NATURAL.test(v.name) ? 100 : 0) +
      (known >= 0 ? 40 - known * 8 : 0) +
      (REGIONS[locale].includes(tag(v)) ? 30 : 0) +
      (NOVELTY.test(v.name) ? -200 : 0) +
      (v.localService ? 10 : 0) +
      (v.default ? 5 : 0)
    );
  };
  const matching = voices.filter((v) => tag(v).split('-')[0] === locale);
  return matching.reduce<V | null>(
    (best, v) => (best === null || score(v) > score(best) ? v : best),
    null,
  );
}

/**
 * Splits text into sentences (some browsers cut long utterances short), only where a full stop is
 * followed by a space: "13.8 billion" stays in one piece.
 */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface Voice {
  /** False when this device has no voice for the language. */
  available(): boolean;
  muted(): boolean;
  setMuted(muted: boolean): void;
  /** True while something is being read (the journey waits for it). */
  speaking(): boolean;
  /** Reads `text` aloud (stopping anything already playing); resolves when it is done. */
  say(text: string): Promise<void>;
  cancel(): void;
  /** Called when the voice list arrives or the mute setting changes. */
  onChange(listener: () => void): void;
}

export function createVoice(locale: Locale): Voice {
  const synth: SpeechSynthesis | undefined =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : undefined;
  const listeners: (() => void)[] = [];
  const changed = (): void => {
    for (const listener of listeners) listener();
  };

  let voice: SpeechSynthesisVoice | null = null;
  let loaded = false;
  const load = (): void => {
    const voices = synth?.getVoices() ?? [];
    loaded = voices.length > 0;
    voice = pickVoice(voices, locale);
    changed();
  };
  load();
  synth?.addEventListener('voiceschanged', load);

  let muted = false;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    // Storage blocked: start with the voice on.
  }

  // The utterances being read, and how to end the current `say` early.
  let finish: (() => void) | null = null;
  let timers: number[] = [];

  const stop = (): void => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
    const done = finish;
    finish = null;
    synth?.cancel();
    done?.();
  };

  // Voices load late in some browsers: until then, try anyway with just the language.
  const available = (): boolean => synth !== undefined && (!loaded || voice !== null);

  return {
    available,
    muted: () => muted,
    setMuted(next) {
      muted = next;
      if (muted) stop();
      try {
        window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
      } catch {
        // Not remembered.
      }
      changed();
    },
    speaking: () => finish !== null,
    say(text) {
      stop();
      if (!synth || muted || !available()) return Promise.resolve();
      const parts = sentences(text);
      if (parts.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        finish = resolve;
        let left = parts.length;
        const partDone = (): void => {
          left -= 1;
          if (left === 0 && finish === resolve) {
            for (const timer of timers) window.clearTimeout(timer);
            timers = [];
            finish = null;
            resolve();
          }
        };
        // Called synchronously, so the first `say` inside a tap unlocks speech on iOS.
        let at = 0;
        try {
          for (const part of parts) {
            const utterance = new SpeechSynthesisUtterance(part);
            utterance.lang = voice?.lang ?? locale;
            if (voice) utterance.voice = voice;
            utterance.rate = RATE;
            utterance.pitch = PITCH;
            let ended = false;
            const end = (): void => {
              if (ended) return;
              ended = true;
              partDone();
            };
            utterance.addEventListener('end', end);
            utterance.addEventListener('error', end);
            synth.speak(utterance);
            // Safari sometimes never says it has finished: give up waiting well after it should have.
            at += (part.length / (13 * RATE)) * 1000 + 600;
            timers.push(window.setTimeout(end, at * 1.6 + 2000));
          }
        } catch (error) {
          // A browser that will not speak must never leave the journey waiting.
          console.warn('Could not speak', error);
          stop();
        }
      });
    },
    cancel: stop,
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
