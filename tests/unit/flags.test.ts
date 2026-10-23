import { describe, expect, it } from 'vitest';
import { flagsForSpan, NEAR_NOW } from '../../src/render/flags';

const BIG_BANG = 13.787e9;
const ids = (span: number) =>
  flagsForSpan(span).map((f) =>
    f.kind === 'cluster' ? `cluster(${f.members.map((m) => m.id).join(',')})` : f.marker.id,
  );

describe('flagsForSpan', () => {
  it('groups the events crowded near Now into one flag at the whole-story view', () => {
    expect(ids(BIG_BANG)).toEqual([
      'cluster(first-people,last-dinosaurs,first-dinosaurs,animals-with-shells)',
      'first-life',
      'solar-system',
      'big-bang',
    ]);
  });

  it('says how far back the group reaches (its oldest member)', () => {
    const cluster = flagsForSpan(BIG_BANG)[0];
    expect(cluster?.kind).toBe('cluster');
    expect(cluster?.years).toBeCloseTo(538.8e6, 0);
    expect((cluster?.years ?? 0) / BIG_BANG).toBeLessThan(NEAR_NOW);
  });

  it('keeps a single event near Now as its own flag', () => {
    // At the dinosaurs' span, people are the only event near Now.
    expect(ids(230e6)).toEqual(['first-people', 'last-dinosaurs', 'first-dinosaurs']);
  });

  it('places each event at its true share of the span', () => {
    for (const flag of flagsForSpan(BIG_BANG)) {
      if (flag.kind === 'event') expect(flag.f).toBeCloseTo(flag.years / BIG_BANG, 12);
    }
  });

  it('leaves out events older than the span', () => {
    expect(ids(66e6)).toEqual(['first-people', 'last-dinosaurs']);
  });
});
