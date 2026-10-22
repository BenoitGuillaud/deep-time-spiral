# Deep Time Spiral

An interactive geologic time spiral that helps children aged 5–8 *feel* how old things are: from their own age, to a grandparent's life, to the dinosaurs, to the formation of Earth, to the Big Bang.

Inspired by the USGS *Geologic Time Spiral* (GIP 58, 2008), with ages updated to the current
[ICS International Chronostratigraphic Chart](https://stratigraphy.org/chart) and a cosmic prologue.

> **Status:** bootstrapping. Nothing to run yet. See the milestones in [CLAUDE.md](CLAUDE.md).

## Run it locally

_Coming in milestone M0 (scaffold)._ Requires Node 26 (see [`.nvmrc`](.nvmrc)).

```bash
npm install
npm run dev            # live-reload dev server
npm run dev -- --host  # also reachable from a tablet on the same Wi-Fi
npm run test
npm run build && npm run preview
```

## Project documents

- [CLAUDE.md](CLAUDE.md): mission, pedagogy, data rules, architecture, quality gates and milestones.
- [CREDITS.md](CREDITS.md): data sources, citations, reuse terms and illustration licences.
- [docs/DEPLOY.md](docs/DEPLOY.md): deployment checklist (GitHub Pages, Vercel, custom domain).

## Licence

_To be decided._ Data and illustrations keep their own licences; see [CREDITS.md](CREDITS.md).
