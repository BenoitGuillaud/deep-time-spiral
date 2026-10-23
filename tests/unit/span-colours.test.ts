import { describe, expect, it } from 'vitest';
import { unit } from '../../src/data';
import { COSMOS_COLOR } from '../../src/render/events';
import { colourAt, rankForSpan, spanBands } from '../../src/render/span-colours';

const BIG_BANG = 13.787e9;

describe('spanBands', () => {
  it.each([7, 80, 11_700, 315_000, 66e6, 230e6, 538.8e6, 3.48e9, 4.54e9, BIG_BANG])(
    'span %s years: bands run from Now to the end, with no gap or overlap',
    (span) => {
      const bands = spanBands(span);
      expect(bands[0]?.from).toBe(0);
      expect(bands.at(-1)?.to).toBe(1);
      bands.slice(1).forEach((b, i) => {
        expect(b.from).toBeCloseTo(bands[i]?.to ?? Number.NaN, 12);
      });
    },
  );

  it('shows the four eons, then the time before the Earth, at the Big Bang view', () => {
    const bands = spanBands(BIG_BANG);
    expect(bands.map((b) => b.unitId)).toEqual([
      'Phanerozoic',
      'Proterozoic',
      'Archean',
      'Hadean',
      null,
    ]);
    const cosmos = bands.at(-1);
    expect(cosmos?.color).toBe(COSMOS_COLOR);
    // True size: the Earth starts a third of the way along; two thirds are before the Earth.
    expect(cosmos?.from).toBeCloseTo((unit('Hadean').begin.ma * 1e6) / BIG_BANG, 12);
    expect(cosmos?.from).toBeCloseTo(0.331, 3);
  });

  it('uses the official ICS colours', () => {
    expect(colourAt(spanBands(BIG_BANG), 0.01)).toBe(unit('Phanerozoic').color);
    expect(colourAt(spanBands(230e6), 0.2)).toBe(unit('Paleogene').color); // 46 Ma
    expect(colourAt(spanBands(7), 0.5)).toBe(unit('Holocene').color);
  });

  it('picks a finer rank for shorter spans', () => {
    expect(rankForSpan(80)).toBe('epoch');
    expect(rankForSpan(66e6)).toBe('period');
    expect(rankForSpan(BIG_BANG)).toBe('eon');
    expect(spanBands(66e6).map((b) => b.unitId)).toEqual(['Quaternary', 'Neogene', 'Paleogene']);
  });

  it('rejects a span that is not a positive number', () => {
    expect(() => spanBands(0)).toThrow(RangeError);
  });
});
