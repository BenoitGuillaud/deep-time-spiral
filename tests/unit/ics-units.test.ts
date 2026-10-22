import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIcsData, JSON_PATH, TTL_PATH } from '../../scripts/ics/build-units';
import { ics, unit, unitsOfRank } from '../../src/data';
import type { IcsRank } from '../../src/data/types';

describe('ics-units.json', () => {
  it('is exactly what the extractor produces from the pinned chart data (no hand edits)', () => {
    const rebuilt = buildIcsData(readFileSync(TTL_PATH, 'utf8'));
    expect(JSON.parse(readFileSync(JSON_PATH, 'utf8'))).toEqual(rebuilt);
  });

  it('comes from chart v2026/06', () => {
    expect(ics.chart.version).toBe('v2026/06');
    expect(ics.chart.license).toMatch(/CC BY 4\.0/);
  });

  // Values checked by eye against the v2026/06 PDF (https://stratigraphy.org/ICSchart/ChronostratChart2026-06.pdf).
  it.each([
    ['Holocene', 'begin', '0.0117', null],
    ['Cretaceous', 'end', '66.00', null],
    ['Cretaceous', 'begin', '143.1', 0.6],
    ['Cambrian', 'begin', '538.8', 0.6],
    ['Cambrian', 'end', '486.85', 1.5],
    ['Quaternary', 'begin', '2.58', null],
    ['Hadean', 'begin', '4567', null],
    ['Hadean', 'end', '4031', 3],
    ['Proterozoic', 'begin', '2500', null],
  ] as const)('%s %s is %s Ma (± %s), as on the PDF', (id, boundary, text, plusMinus) => {
    expect(unit(id)[boundary].text).toBe(text);
    expect(unit(id)[boundary].plusMinus).toBe(plusMinus);
  });

  it('marks approximate ages the way the PDF shows "~"', () => {
    expect(unit('Ediacaran').begin.uncertain).toBe(true); // ~635
    expect(unit('Cretaceous').end.uncertain).toBe(false); // 66.00
  });

  it('keeps the official colours and names', () => {
    expect(unit('Cretaceous').color).toBe('#7FC64E');
    expect(unit('Hadean').color).toBe('#AE027E');
    expect(unit('Cretaceous').labels).toEqual({
      en: 'Cretaceous',
      fr: 'Crétacé',
      de: 'Kreide',
      hu: 'kréta',
    });
  });

  it('names every eon, era and period in all four languages', () => {
    const named: IcsRank[] = ['super-eon', 'eon', 'era', 'period', 'sub-period'];
    for (const u of ics.units.filter((x) => named.includes(x.rank))) {
      expect(u.labels, u.id).not.toBeNull();
    }
  });

  const ranks: IcsRank[] = ['eon', 'era', 'period', 'sub-period', 'epoch'];

  it.each(ranks)('%s units are contiguous and do not overlap', (rank) => {
    const units = unitsOfRank(rank);
    expect(units.length).toBeGreaterThan(1);
    units.slice(1).forEach((younger, i) => {
      const older = units[i];
      expect(older?.end, `${String(older?.id)} → ${younger.id}`).toEqual(younger.begin);
    });
  });

  it.each(ranks)('%s ages decrease monotonically from older to younger', (rank) => {
    const byOrder = ics.units.filter((u) => u.rank === rank).sort((a, b) => b.order - a.order);
    for (const [i, u] of byOrder.entries()) {
      expect(u.begin.ma, u.id).toBeGreaterThan(u.end.ma);
      const next = byOrder[i + 1];
      if (next) expect(next.begin.ma, `${u.id} → ${next.id}`).toBeLessThan(u.begin.ma);
    }
  });

  it('nests every unit inside its parent', () => {
    const rankDepth: Record<IcsRank, number> = {
      'super-eon': 0,
      eon: 1,
      era: 2,
      period: 3,
      'sub-period': 4,
      epoch: 5,
    };
    for (const child of ics.units.filter((u) => u.parent !== null)) {
      const parent = unit(child.parent ?? '');
      expect(rankDepth[parent.rank], `${child.id} in ${parent.id}`).toBeLessThan(
        rankDepth[child.rank],
      );
      expect(child.begin.ma, `${child.id} starts inside ${parent.id}`).toBeLessThanOrEqual(
        parent.begin.ma,
      );
      expect(child.end.ma, `${child.id} ends inside ${parent.id}`).toBeGreaterThanOrEqual(
        parent.end.ma,
      );
    }
  });

  it('covers all of Earth history with eons, from 4567 Ma to now', () => {
    const eons = unitsOfRank('eon');
    expect(eons[0]?.begin.ma).toBe(4567);
    expect(eons.at(-1)?.end.ma).toBe(0);
  });
});
