# Credits and sources

Every number shown in Deep Time Spiral comes from a source listed here. Ages of geologic units come only
from the ICS International Chronostratigraphic Chart. Every other age lives in `src/data/events.json`
with its own citation.

> Entries marked `TODO(source)` have not been checked against the original source yet.
> Do not publish them until they are verified and copied word for word from the source.

## Geologic time scale

**International Chronostratigraphic Chart, version v2026/06** (accessed 2026-10-22).

- Chart: https://stratigraphy.org/chart. PDF: https://stratigraphy.org/ICSchart/ChronostratChart2026-06.pdf
- Data: `chart.ttl` at tag [`v2026-06.5`](https://github.com/i-c-stratigraphy/chart/releases/tag/v2026-06.5)
  of https://github.com/i-c-stratigraphy/chart. Ages, uncertainties, colours and unit names in en/fr/de/hu all come
  from this file.
- Reuse terms: **Creative Commons Attribution 4.0** (https://creativecommons.org/licenses/by/4.0/). This is stated on
  the chart itself and in the data repository's README.

Credit text, copied word for word from the footer of the v2026/06 chart (English PDF):

> Colouring follows the Commission for the Geological Map of the World (www.ccgm.org)
>
> © International Commission on Stratigraphy, 2026
>
> This Chart is available for use in accordance with the Creative Commons BY 4.0 license
> (https://creativecommons.org/licenses/by/4.0/)
>
> Cite: Cohen K, Harper D, Gibbard P, Car N. The ICS international chronostratigraphic chart this decade. Episodes
> 2025;48:105-115. https://doi.org/10.18814/epiiugs/2025/025001. Modified 2024-12.

Our own line: *Chart version used: v2026/06 — https://stratigraphy.org/chart*

Notes:
- "Modified 2024-12" is printed as-is on the v2026/06 chart. It looks like leftover text from the previous version.
- Cross-checked: Crossref and the Episodes page give the same title, journal, volume 48(1) and pages 105–115. The
  Episodes page lists the authors as Kim Cohen, David Harper, Philip Gibbard and Nicholas Car. The article itself is
  CC BY-NC 4.0; we only cite it.

## Inspiration

Suggested citation, copied word for word from the USGS citation file
(https://pubs.usgs.gov/gip/2008/58/citation_history.doc, accessed 2026-10-22):

> Graham, Joseph, Newman, William, and Stacy, John, 2008, The geologic time spiral—A path to the past (ver. 1.1):
> U.S. Geological Survey General Information Product 58, poster, 1 sheet. (Also available online at
> http://pubs.usgs.gov/gip/2008/58/.)

We borrow the idea of a time spiral only. No USGS artwork is reproduced. USGS reuse policy
(https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits): "USGS-authored or produced data
and information are considered to be in the U.S. Public Domain."

## Event ages (non-ICS)

_Added in milestone M1. One full citation per entry in `src/data/events.json`, including its URL and the date it was accessed._

| Event | Value used | Citation | URL | Accessed |
|---|---|---|---|---|

## Illustrations

_Original SVG icons drawn in code unless listed here. Openly licensed images (CC0 / CC BY only) are listed with
their author, source and licence._

| Image | Author | Source | Licence |
|---|---|---|---|

## Software

_Added in milestone M0: Vite, TypeScript, D3 and the other open-source libraries used, with their licences._
