/**
 * Regenerates src/data/ics-units.json from the vendored ICS chart data.
 * Run with `npm run data:ics`. See data/ics/SOURCE.md.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { IcsData } from '../../src/data/types.ts';
import { extractUnits } from './extract-units.ts';

export const CHART = {
  version: 'v2026/06',
  source: 'https://github.com/i-c-stratigraphy/chart/blob/v2026-06.5/chart.ttl',
  commit: '44d1043ecf295cce1be03b3fc5fa95ca65fe770b',
  sha256: '0158959e8fdae2a8bdbb14ca3e424d2370362cd8dfc8af86e7be73c74368b355',
  license: 'CC BY 4.0, © International Commission on Stratigraphy, 2026',
} as const;

export const TTL_PATH = new URL('../../data/ics/chart.ttl', import.meta.url);
export const JSON_PATH = new URL('../../src/data/ics-units.json', import.meta.url);

export function buildIcsData(ttl: string): IcsData {
  const sha256 = createHash('sha256').update(ttl).digest('hex');
  if (sha256 !== CHART.sha256) {
    throw new Error(`data/ics/chart.ttl does not match the pinned release (sha256 ${sha256})`);
  }
  return { chart: { ...CHART }, units: extractUnits(ttl) };
}

if (import.meta.main) {
  const data = buildIcsData(readFileSync(TTL_PATH, 'utf8'));
  writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${String(data.units.length)} units to src/data/ics-units.json`);
}
