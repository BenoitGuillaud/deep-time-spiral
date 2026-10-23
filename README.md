# Deep Time Spiral

An interactive geologic time spiral that helps children aged 5–8 *feel* how old things are: from their own age, to a grandparent's life, to the dinosaurs, to the formation of Earth, to the Big Bang.

Inspired by the USGS *Geologic Time Spiral* (GIP 58, 2008), with ages updated to the current
[ICS International Chronostratigraphic Chart](https://stratigraphy.org/chart) and a cosmic prologue.

> **Status:** M0 scaffold, a "hello spiral" page. Live at https://benoitguillaud.github.io/deep-time-spiral/
> once GitHub Pages is switched on. See the milestones in [CLAUDE.md](CLAUDE.md).

## Run it locally

Requires Node 26 (see [`.nvmrc`](.nvmrc)).

```bash
npm install
npm run dev            # live-reload dev server at http://localhost:5173
npm run dev -- --host  # also reachable from a tablet on the same Wi-Fi (use the "Network" URL it prints)
npm run build && npm run preview
```

## Checks

```bash
npm run check                          # typecheck, lint, format check, unit tests (Vitest)
npx playwright install chromium webkit # once, before the first e2e run
npm run test:e2e                       # Playwright: Chromium + WebKit, tablet + phone
npm run format                         # fix formatting
npm run data:ics                       # regenerate src/data/ics-units.json from data/ics/chart.ttl
```

Every pull request runs the same checks in GitHub Actions, plus Lighthouse on mobile (accessibility ≥ 95,
performance ≥ 90). Merging to `main` deploys to GitHub Pages.

## Project documents

- [CLAUDE.md](CLAUDE.md): mission, pedagogy, data rules, architecture, quality gates and milestones.
- [CREDITS.md](CREDITS.md): data sources, citations, reuse terms and illustration licences.
- [docs/DEPLOY.md](docs/DEPLOY.md): deployment checklist (GitHub Pages, Vercel, custom domain).

## Licence

_To be decided._ Data and illustrations keep their own licences; see [CREDITS.md](CREDITS.md).
