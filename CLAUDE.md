# CLAUDE.md — Deep Time Spiral (standing context)

## Mission
Build **Deep Time Spiral**, a web app that helps **5–8 year olds** *feel* time scales: from their own age, to one human life, to the dinosaurs, to the formation of Earth, to the Big Bang. It is inspired by the USGS *Geologic Time Spiral* (GIP 58, 2008). It updates the ages to the **current ICS International Chronostratigraphic Chart** and adds a cosmic prologue.

The success test: after 10 minutes, a 7-year-old can say, unprompted, something like *"dinosaurs were way, way, way before people"* and *"the Earth is super old but the universe is even older."* Grasping the **ratios** matters more than learning names.

## Audience and pedagogy principles (first principles)
1. **Kids aged 5–8 can't picture large numbers.** Never rely on "4.5 billion" alone. Always pair a number with a **relatable comparison**: their own age, a grandparent's life, "stack 1,000 grandmas".
2. **One idea per screen.** Few words, big touch targets (≥ 48 px), big friendly icons.
3. **Read-aloud first.** Every text string can be spoken (browser text-to-speech). Assume the child may not read.
4. **Curiosity loop:** a guided tour first, then free exploration with "tap to discover" surprises.
5. **Honest science, simple words.** Simplify the wording, never the facts. Uncertain ages are shown as "about" or "at least".

## Experience spec

**Core mechanic — the Zoom Ladder + the Shrinking Dot.**
The spiral is the map. The ladder is how you travel along it. At each rung we zoom out. The whole previous timeline shrinks into a glowing dot near "Now", and a counter shows how many copies of it fit into the new span ("×1,000").

Proposed rungs (about 10). Exact values come from the cited sources at build time; the labels below are kid-facing approximations.

| # | Rung (kid label) | Approx. age | Source rule |
|---|---|---|---|
| 1 | **You!** (child enters their age, 3–10) | 5–8 years | User input |
| 2 | A grandparent's whole life | ~80 years | Illustrative; label "about" |
| 3 | The pyramids are built | ~4,500 years | Cite (e.g. Great Pyramid of Giza dating) |
| 4 | Ice age ends (Holocene begins) | 11,700 years | **ICS chart** |
| 5 | The first people like us (*Homo sapiens*) | ~300,000 years | Cite primary paper (e.g. Jebel Irhoud, Hublin et al. 2017) |
| 6 | The last dinosaurs (end-Cretaceous) | 66.0 Ma | **ICS chart** |
| 7 | The first dinosaurs | ~230 Ma | Cite primary/review source; mark "about" |
| 8 | Explosion of animals with shells (Cambrian) | 538.8 Ma | **ICS chart** |
| 9 | First life | at least ~3.5 Ga | Cite; mark "at least" (uncertain) |
| 10 | Earth and Moon form / Sun and planets form | ~4.54 / 4.567 Ga | ICS chart for the Hadean base; cite for the solar system |
| 11 | The Big Bang | 13.8 Ga | Cite Planck 2018 cosmological parameters |

**The spiral is 3D and interactive** (Benoît's requirement, 2026-10-23; every milestone builds on it): a **vortex** you can spin, tilt, pinch-zoom and pan, showing the ICS eons, eras and periods with **official ICS colours**. Event icons sit on the spiral; tapping one flies the camera to it and opens its card (later read aloud).
- **Shape:** Now at the top centre; the past spirals outward **and downward**, with **depth proportional to time** (older = deeper, like rock layers). Seen from straight above it is the honest flat map (equal time = equal path length); seen from the side it is a vertical timeline. The Big Bang is at the bottom rim.
- **Views:** Home (3D), Top (honest flat map), Side (timeline), and a **2D** SVG view that is also the fallback when WebGL is missing or drawn in software (no graphics chip: about 2 frames per second). `?view=2d` / `?view=3d` force either. Under reduced motion the camera jumps instead of flying and nothing spins on its own.
- **Zoom lens:** a second, re-scaled vortex for the Phanerozoic floats next to the main one, joined by a light beam, with an honest "Zoom ×N" label. Deeper zooms (down to a child's own age) are the Zoom Ladder (M3).
- Time→spiral mapping must be a pluggable function: linear (honest) and log-like (readable). The ladder can switch mapping per rung. The kid view must never show a distorted scale without a visual cue (e.g. a "zoom lens" frame).

**Guided tour:** 10–12 stops following the ladder (Next / Back / Repeat-voice buttons) and a short celebration at the end. Then it unlocks **Explore mode** (free zoom, tap events, "surprise me" button).

**Grown-up mode (small toggle, hidden from kids):** exact ICS values with ± uncertainty, unit names, and full sources and credits.

**Narration:** Web Speech API (`speechSynthesis`), one voice per locale (en, fr, de, hu). Degrade gracefully when a voice is missing (show text and a speaker icon greyed out).

**Languages:** EN, FR, DE, HU from v1 via i18n JSON files. No hard-coded UI strings. Number formatting follows the locale (`Intl.NumberFormat`).

**Devices:** tablet-first, touch-first, responsive down to phone width. Must also work on a desktop with a mouse.

**Accessibility:** WCAG 2.1 AA contrast, keyboard navigation, `prefers-reduced-motion`. Colour is never the only carrier of meaning (ICS colours plus labels/icons).

## Data and attribution — HARD RULES
1. **Ages of geologic units come only from the latest ICS International Chronostratigraphic Chart.** As of 2026-10-22 this is **v2026/06**: https://stratigraphy.org/ICSchart/ChronostratChart2026-06.pdf (landing page: https://stratigraphy.org/chart). **Check stratigraphy.org first for a newer version.** The official machine-readable source is `chart.ttl` in https://github.com/i-c-stratigraphy/chart, which ICS calls "the authoritative data" of the chart (CC BY 4.0). Generate `src/data/ics-units.json` from it with a script, pinned to a release tag (currently `v2026-06.5`). Never transcribe ages by hand. Tests spot-check the generated values against the PDF.
2. **ICS colours** come from the official ICS colour codes (RGB), not from guesses. Use the `schema:color` hex values in `chart.ttl` (the chart's colouring follows the Commission for the Geological Map of the World, CCGM).
3. **Every non-ICS number** (cosmic ages, first dinosaurs, Homo sapiens, pyramids…) lives in `data/events.json` with a mandatory `source` object `{citation, url, accessed}`. A test fails the build if any event lacks a source.
4. Store the uncertainty (`±`, `~`, "at least") in the data, and render it as "about" or "at least" for kids.
5. **Credits page plus a footer link**, reproduced faithfully:
   - The ICS chart credit, **copied word for word from the footer of the chart version used** (never paraphrased), followed by our own line *"Chart version used: v2026/06 — https://stratigraphy.org/chart"*. The exact v2026/06 wording is recorded in `CREDITS.md`. When the chart version changes, re-copy the footer from the new chart.
   - *Inspired by: "The Geologic Time Spiral — A Path to the Past", U.S. Geological Survey General Information Product 58, version 1.1 (2008), designed by Joseph Graham, William Newman, and John Stacy. https://pubs.usgs.gov/gip/2008/58/*
   - The full citation for every source in `events.json`.
   - The licence of every illustration used.
6. **Check the reuse terms** of the ICS chart (stratigraphy.org) and of any icon set before shipping. Record them in `CREDITS.md`.
7. **Illustrations:** original SVG icons drawn in code, or openly licensed silhouettes (e.g. PhyloPic for organisms — check each image's licence: CC0 / CC BY only, record the attribution). **No copyrighted characters or franchise art.**

## Tech stack and architecture
- **Vite + TypeScript (strict) + three.js + D3 v7**, with no UI framework. three.js (WebGL) draws the 3D vortex; D3 draws the 2D SVG view and the event badges. A small hand-rolled state/router is enough.
- The 2D view renders first and draws itself in; only then (about 3 s, in idle time) is WebGL checked and the three.js code loaded (`import()`), so the first paint stays fast and Lighthouse stays ≥ 90. CI machines have no graphics chip, so Lighthouse in CI measures the 2D experience; the 3D e2e tests force 3D with `?view=3d`.
- Package manager: npm. Node LTS pinned via `.nvmrc`.
- TypeScript is pinned to **6.0.x**, not 7.x: typescript-eslint 8.x supports only `typescript <6.1.0` (checked 2026-10-22). Revisit when typescript-eslint supports TypeScript 7.
- Visual-regression screenshots start in M2. Baselines must be made in the same Linux setup as CI (Playwright's Docker image), because screenshots differ between macOS and Linux.
- Suggested layout:
  ```
  src/
    data/        ics-units.json, events.json, ladder.json (+ schema.ts with zod validation)
    geometry/    spiral.ts (time→angle/radius mappings, pure functions)
    render/      2D SVG scene, layout, illustrations (shared with 3D)
    render3d/    three.js vortex: scene, ribbon, stickers, camera, view buttons
    tour/        tour.ts, steps.ts
    i18n/        en.json fr.json de.json hu.json, i18n.ts
    voice/       speech.ts
    ui/          controls, grown-up-mode, credits
  tests/
    unit/        (Vitest) geometry, data integrity, i18n completeness
    e2e/         (Playwright) tour flow, explore mode, language switch, visual snapshots
  ```
- The base path must be configurable: GitHub Pages serves under `/<repo-name>/`, while Vercel serves at `/`. Use `VITE_BASE` / the `base` option in `vite.config.ts` per environment.

## Quality gates (CI must pass before merge)
- `tsc --noEmit`, ESLint, Prettier.
- **Vitest:**
  - ICS units are contiguous and non-overlapping.
  - Ages decrease monotonically from older to younger.
  - Each child unit nests inside its parent.
  - Every event has a source.
  - Every i18n key exists in all 4 locales.
  - The geometry functions are monotonic and invertible.
- **Playwright** (Chromium + WebKit, tablet and phone viewports): the 3D view loads and responds to spin, zoom and fly-to (with a 2D fallback without WebGL), the full guided tour completes, the language switch works, and screenshot visual regression runs on key screens (3D Home/Top/Side and 2D).
- **Lighthouse CI:** accessibility ≥ 95, performance ≥ 90 on mobile.

## Delivery pipeline (three stages)
1. **Local:** `npm run dev` (live reload), `npm run test`, `npm run build && npm run preview`.
2. **GitHub Pages (public repo):** a GitHub Actions workflow builds on push to `main` and deploys to Pages with `VITE_BASE=/<repo>/`. A separate CI workflow runs all quality gates on every PR.
3. **Vercel + custom domain (production):**
   - Import the GitHub repo into Vercel (framework preset Vite, `VITE_BASE=/`).
   - Every PR gets a Vercel preview URL (this becomes staging). `main` deploys to production.
   - Add the subdomain (e.g. `time.<mydomain>`) in Vercel → Domains. Vercel shows the exact CNAME target. **Use the value Vercel displays; do not hard-code one.**
   - At HostGator: cPanel → Zone Editor → add a CNAME record for the subdomain pointing to that target. Wait for Vercel to verify the domain and issue SSL.
   - Claude Code cannot log into Vercel or HostGator for me. Produce a step-by-step checklist (`docs/DEPLOY.md`) and verify afterwards with `dig` / `curl -I`.
   - Once Vercel is live, decide whether GitHub Pages stays as a mirror or is switched off. Ask me.

## Milestones (each = small PRs, each shippable)
- **M0 Scaffold:** repo, Vite+TS+D3, lint/test tooling, CI, Pages deploy of a "hello spiral". ✅ when the Pages URL works.
- **M1 Data:** ICS units + colours + events with sources, zod schemas, integrity tests. ✅ when the tests are green and the data is reviewed by me.
- **M2 3D spiral:** the 3D vortex (three.js) with ICS colours, spin/zoom/pan, fly-to, tap cards, Home/Top/Side views and the 2D fallback. ✅ when visual snapshots are approved.
- **M3 Ladder + Shrinking Dot + Guided tour (EN),** in 3D, reusing the fly-to camera: ✅ when a 7-year-old test user completes the tour. I'll do the kid test.
- **M4 Voice + i18n (FR/DE/HU):** ✅ when all locales are complete and TTS degrades gracefully.
- **M5 Vercel + custom domain:** ✅ when production is live on the subdomain over HTTPS.
- **M6 Polish:** grown-up mode, credits page, accessibility, reduced motion, optional offline PWA.

## Working agreement
- Start each milestone in **plan mode**: propose the plan and the tradeoffs, wait for my OK, then implement.
- Small, reviewable commits with conventional commit messages. Open PRs with a short description and screenshots.
- **Flag confidence:** for any fact, say whether it is from a cited source, inferred, or a guess. Never invent ages or citations. If you can't verify something, leave a `TODO(source)` and tell me.
- Ask before adding dependencies beyond the stack above.
- **Plan budget (Claude Pro):** plan milestones on Opus; implement routine changes (copy, i18n strings, new events, small fixes) on Sonnet. Suggest a `/model` switch when a task clearly fits the other model. Keep sessions focused: one milestone or PR per session.
- **Human checkpoints:** whenever a step needs my login, a browser click or a paid/irreversible action, STOP. Tell me exactly what to do (where to click, what to paste), wait for my "done", then verify it yourself (`gh`, `curl -I`, `dig`).
- Keep `CLAUDE.md`, `README.md`, `CREDITS.md` and `docs/DEPLOY.md` up to date.

## Project facts (recorded during bootstrap, 2026-10-22)
- GitHub repo: `BenoitGuillaud/deep-time-spiral` (public).
- Node: **26** (`.nvmrc`). Per the official Node.js release schedule, Node 26 becomes Active LTS on 2026-10-28 and is supported until 2029-04-30.

## Decisions log
- **2026-10-22 (B4 research, approved):**
  - Use ICS chart **v2026/06**, with data generated from `chart.ttl` at tag `v2026-06.5`. Its 2026/06 changes touch only Permian/Triassic boundaries, none of the ladder rungs.
  - `chart.ttl` also carries the **official unit names in en, fr, de and hu**. Use them; never translate geological unit names ourselves.
  - Approximate ages ("~" on the PDF) are encoded in `chart.ttl` as `skos:note "uncertain"` on a boundary. ± values are `schema:marginOfError`.
  - The ICS Hadean base (**4567 Ma**) is the age of the solar system's first solids, not Earth's formation. "Earth forms" (~4.54 Ga) and "solar system forms" each need their own citation in `events.json`.
  - **Spiral orientation** (the "flat 2D" part is superseded by the 3D vortex, 2026-10-23): a flat 2D spiral seen from above, with **Now at the centre** and the past spiralling outward. This is the opposite of USGS GIP 58 (Now on the outer edge). Zooming out keeps Now fixed, so the Shrinking Dot sits at the centre.
  - **Time mapping:** honest linear scale by default. The readable log-like scale appears only inside a visible "zoom lens" frame. (GIP 58 silently stretches the Cenozoic and crushes the Precambrian.)
  - Keep from GIP 58: one continuous path a finger can trace, life pictures as the hook, few rounded numbers, a cosmic swirl at the start of time. Change: official ICS colours and names, a few big tappable icons, human-scale rungs, and a Big Bang prologue.
- **2026-10-22/23 (M1 data; reviewed and merged as PR #3):**
  - `data/ics/chart.ttl` is vendored unmodified (pinned tag, commit and SHA-256 in `data/ics/SOURCE.md`). `npm run data:ics` regenerates `src/data/ics-units.json`; a test fails if the JSON differs from a fresh extraction.
  - **No new dependencies:** a small Turtle parser in `scripts/ics/turtle.ts` (rejects unsupported syntax) instead of `n3`, and hand-written runtime validation in `src/data/validate.ts` instead of `zod`. Either can be swapped in later if wanted.
  - Scripts are TypeScript run directly by Node 26 (type stripping), so `tsconfig.json` has `allowImportingTsExtensions` and `erasableSyntaxOnly`.
  - Kept ranks: super-eon, eon, era, period, sub-period, epoch (ages/stages left out). 21 epochs have no names in the chart data (e.g. "Lower Jurassic"); their `labels` are `null` rather than invented.
  - Every cited event age records `detail`: where in the source the number appears. ICS-based events reference a unit boundary instead of copying the number.
  - Pyramids rung: `TODO(source)`, left out until a source stating the Great Pyramid's date is checked.
- **2026-10-23 ("whoa" 2D spiral; merged as PR #4, now the base and the 2D fallback):**
  - One honest spiral from Now (centre) to the Big Bang (outer end), **even speed**: equal time = equal path length (`evenSpiralPoint`). A starry violet band (not an ICS colour) for the time before Earth, then the four eons in ICS colours.
  - A **magnifier + light beam + zoom lens** shows the Phanerozoic (538.8 Ma → now) by ICS period. The "Zoom ×N" badge is computed from the real path lengths, so the distortion cue is honest.
  - Turns are tuned so events spread around the clock (main 3.75 turns, lens 2.25). Badge positions are exact; only "people" (too close to now) sits beside its spot, with a pointer line to it.
  - Tapping a picture opens a `<dialog>` card: kid-level fact, rounded age (never finer than the source), and a source link.
  - Illustrations: PhyloPic CC0/CC BY silhouettes for animals, original code drawings for the rest. A small in-app **Credits** link meets the CC BY attribution for the ICS data and the trilobite until the M6 credits page.
  - Not yet: pinch/scroll zoom and pan (M2), the Ladder + Shrinking Dot and tour (M3), voice and other languages (M4).
- **2026-10-23 (3D, Benoît's decision after seeing #4): the spiral must be 3D and interactive, from now on.**
  - Shape: **vortex cone**: even-speed 2D spiral in the horizontal plane + **depth ∝ time**. Top view = honest flat map; side view = timeline.
  - Library: **three.js** (MIT), loaded lazily after the 2D view. Event stickers stay HTML buttons (three.js `CSS2DRenderer`) for keyboard, screen readers and 48 px targets.
  - Interaction: **free 3D + fly-to** (one finger spins, two fingers pinch/pan; tapping a sticker flies the camera there; Home/Top/Side/2D buttons). Auto-spin only when idle, never under reduced motion.
  - The 2D SVG scene from PR #4 is kept as the first paint and the fallback, and shares data, illustrations, cards and wording with 3D.
