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

Full citations, with the place in each source where the number appears, live in `src/data/events.json`; a test fails
if any event lacks one. Events taken from the ICS chart (start of the Cambrian, end of the Cretaceous, start of the
Holocene) point at the chart boundary instead of copying the number.

| Event | Value used | Citation | URL | Accessed |
|---|---|---|---|---|
| Big Bang | 13.787 ± 0.020 billion years | Planck Collaboration (2020). Planck 2018 results. VI. Cosmological parameters. *A&A* 641, A6. Table 2, TT,TE,EE+lowE+lensing+BAO. | https://doi.org/10.1051/0004-6361/201833910 | 2026-10-22 |
| Sun and planets form | 4567.30 ± 0.16 million years | Connelly, J. N., et al. (2012). The absolute chronology and thermal processing of solids in the solar protoplanetary disk. *Science* 338(6107), 651–655. Abstract. | https://doi.org/10.1126/science.1226919 | 2026-10-22 |
| Earth | 4.54 billion years | Dalrymple, G. B. (2001). The age of the Earth in the twentieth century: a problem (mostly) solved. *Geol. Soc. London Spec. Publ.* 190, 205–221. Abstract. | https://doi.org/10.1144/GSL.SP.2001.190.01.14 | 2026-10-22 |
| First life (at least) | 3.48 billion years | Djokic, T., et al. (2017). Earliest signs of life on land preserved in ca. 3.5 Ga hot spring deposits. *Nature Communications* 8, 15263. Abstract. | https://doi.org/10.1038/ncomms15263 | 2026-10-22 |
| First dinosaurs | about 230 million years | Martinez, R. N., et al. (2011). A basal dinosaur from the dawn of the dinosaur era in southwestern Pangaea. *Science* 331(6014), 206–210. Summary. | https://doi.org/10.1126/science.1198467 | 2026-10-22 |
| First people like us (*Homo sapiens*) | 315 ± 34 thousand years | Richter, D., et al. (2017). The age of the hominin fossils from Jebel Irhoud, Morocco, and the origins of the Middle Stone Age. *Nature* 546(7657), 293–296. Abstract. | https://doi.org/10.1038/nature22335 | 2026-10-22 |

`TODO(source)`: the pyramids rung (about 4,500 years) still needs a source that states the Great Pyramid's date; the
radiocarbon studies checked so far (Bonani et al. 2001; Bronk Ramsey et al. 2010) do not give it in their abstracts.

## Illustrations

_Original SVG icons drawn in code unless listed here. Openly licensed images (CC0 / CC BY only) are listed with
their author, source and licence._

| Image | Author | Source | Licence |
|---|---|---|---|

## Software

Shipped to the browser:

| Package | Licence | Notes |
|---|---|---|
| [D3](https://d3js.org) 7.9 | ISC | The bundle includes d3-selection, d3-shape, d3-path and d3-array (all ISC). |

> When D3 transitions are added, `d3-ease` comes into the bundle. It is BSD-3-Clause, and its licence notice must be
> added here.

Used to build and test only (not shipped):

| Package | Licence |
|---|---|
| Vite | MIT |
| TypeScript | Apache-2.0 |
| Vitest | MIT |
| Playwright | Apache-2.0 |
| ESLint, typescript-eslint | MIT |
| Prettier | MIT |
| Lighthouse CI (`@lhci/cli`) | Apache-2.0 |
