import { describe, expect, it } from 'vitest';
import { advanceClock } from '../../src/tour/player';
import { pickVoice, sentences, type VoiceInfo } from '../../src/voice/speech';

// The voices macOS offered in Chromium on 2026-10-23 (a selection), including the joke ones.
const mac: VoiceInfo[] = [
  ['Daniel (English (United Kingdom))', 'en-GB', true],
  ['Albert', 'en-US', false],
  ['Grandpa (English (United States))', 'en-US', false],
  ['Samantha', 'en-US', false],
  ['Zarvox', 'en-US', false],
  ['Amélie', 'fr-CA', false],
  ['Grandma (French (France))', 'fr-FR', false],
  ['Thomas', 'fr-FR', false],
  ['Eddy (German (Germany))', 'de-DE', false],
  ['Anna', 'de-DE', false],
  ['Tünde', 'hu-HU', false],
].map(([name, lang, isDefault]) => ({
  name: String(name),
  lang: String(lang),
  localService: true,
  default: Boolean(isDefault),
}));

describe('pickVoice', () => {
  it('picks a clear voice from the home region, never a joke voice', () => {
    expect(pickVoice(mac, 'en')?.name).toBe('Samantha');
    expect(pickVoice(mac, 'fr')?.name).toBe('Thomas');
    expect(pickVoice(mac, 'de')?.name).toBe('Anna');
    expect(pickVoice(mac, 'hu')?.name).toBe('Tünde');
  });

  it('prefers natural-sounding voices', () => {
    const edge = [
      ...mac,
      {
        name: 'Microsoft Henri Online (Natural) - French',
        lang: 'fr-FR',
        localService: false,
        default: false,
      },
    ];
    expect(pickVoice(edge, 'fr')?.name).toContain('Natural');
  });

  it('returns null when the language has no voice', () => {
    expect(
      pickVoice(
        mac.filter((v) => !v.lang.startsWith('hu')),
        'hu',
      ),
    ).toBeNull();
  });
});

describe('sentences', () => {
  it('splits text into sentences, keeping decimal numbers whole', () => {
    expect(sentences('The Big Bang. about 13.8 billion years ago. Our universe begins!')).toEqual([
      'The Big Bang.',
      'about 13.8 billion years ago.',
      'Our universe begins!',
    ]);
  });
});

describe('the journey clock', () => {
  const steps = [
    { kind: 'hold' as const, f: 0, ms: 1000 },
    { kind: 'travel' as const, from: 0, to: 1, ms: 1000 },
  ];

  it('follows real time while the voice is quiet', () => {
    expect(advanceClock(steps, 900, 300, false)).toBe(1200);
  });

  it('waits at the end of a step while the voice is still reading', () => {
    const held = advanceClock(steps, 900, 300, true);
    expect(held).toBeLessThan(1000);
    expect(held).toBeGreaterThan(999);
    // And goes on once it has finished.
    expect(advanceClock(steps, held, 16, false)).toBeGreaterThan(1000);
  });
});
