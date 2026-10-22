# ICS chart data (vendored)

`chart.ttl` is an unmodified copy of the official data behind the International Chronostratigraphic Chart.

| | |
|---|---|
| Chart version | v2026/06 |
| Source | https://github.com/i-c-stratigraphy/chart/blob/v2026-06.5/chart.ttl |
| Release tag | `v2026-06.5` (commit `44d1043ecf295cce1be03b3fc5fa95ca65fe770b`) |
| SHA-256 | `0158959e8fdae2a8bdbb14ca3e424d2370362cd8dfc8af86e7be73c74368b355` |
| Downloaded | 2026-10-22 |
| Licence | CC BY 4.0, © International Commission on Stratigraphy, 2026 (see [CREDITS.md](../../CREDITS.md)) |

`npm run data:ics` turns it into `src/data/ics-units.json`. Never edit either file by hand. To move to a newer chart:
replace `chart.ttl` with the new release's file, update the version, tag, commit and SHA-256 here and in
`scripts/ics/build-units.ts`, then run `npm run data:ics` and `npm test`.
