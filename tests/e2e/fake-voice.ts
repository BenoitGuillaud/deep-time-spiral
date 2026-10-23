import type { Page } from '@playwright/test';

/**
 * A stand-in for the browser's voices (headless browsers have none): it records what is said and
 * "speaks" at `msPerChar`, so tests can check the words, the language, the speed, and that the
 * journey waits for them.
 */
export interface Spoken {
  text: string;
  lang: string;
  rate: number;
}

export async function installFakeVoice(
  page: Page,
  { msPerChar = 1, languages = ['en-GB', 'fr-FR', 'de-DE', 'hu-HU'] } = {},
): Promise<void> {
  await page.addInitScript(
    ({ msPerChar, languages }) => {
      const spoken: { text: string; lang: string; rate: number }[] = [];
      const pending = new Map<EventTarget, number>();
      let interrupted = 0;
      const voices = languages.map((lang) => ({
        name: `Test voice ${lang}`,
        lang,
        localService: true,
        default: false,
        voiceURI: lang,
      }));
      const fake = {
        getVoices: () => voices,
        speak(u: EventTarget & { text: string; lang: string; rate: number }) {
          spoken.push({ text: u.text, lang: u.lang, rate: u.rate });
          const timer = window.setTimeout(() => {
            pending.delete(u);
            u.dispatchEvent(new Event('end'));
          }, u.text.length * msPerChar);
          pending.set(u, timer);
        },
        cancel() {
          if (pending.size > 0) interrupted += 1;
          for (const timer of pending.values()) window.clearTimeout(timer);
          pending.clear();
        },
        addEventListener: () => undefined,
        speaking: false,
        paused: false,
        pending: false,
      };
      // Plain utterances, so the test voices above can be set on them.
      class FakeUtterance extends EventTarget {
        text: string;
        lang = '';
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        constructor(text: string) {
          super();
          this.text = text;
        }
      }
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: FakeUtterance,
        configurable: true,
      });
      Object.assign(window, {
        fakeVoice: { spoken, interrupted: () => interrupted },
      });
    },
    { msPerChar, languages },
  );
}

export function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(
    () => (window as unknown as { fakeVoice: { spoken: Spoken[] } }).fakeVoice.spoken,
  );
}

export function interruptions(page: Page): Promise<number> {
  return page.evaluate(() =>
    (window as unknown as { fakeVoice: { interrupted: () => number } }).fakeVoice.interrupted(),
  );
}
