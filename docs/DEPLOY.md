# Deployment checklist

Three stages: **local → GitHub Pages → Vercel + custom domain**. Steps marked 🧑 need a person (a login, a
browser click, or a paid or irreversible action). Claude Code verifies each one afterwards with `gh`,
`curl -I` or `dig`.

## 1. Local

```bash
npm run dev            # http://localhost:5173
npm run dev -- --host  # also exposes the dev server on the Wi-Fi network for tablet testing
npm run build && npm run preview
```

## 2. GitHub Pages (milestone M0)

- [x] `pages.yml` builds on every push to `main` with `VITE_BASE=/deep-time-spiral/` and deploys to Pages.
- [x] Enable Pages with the source set to **GitHub Actions** (done with the API call below on 2026-10-22):
      `gh api -X POST repos/BenoitGuillaud/deep-time-spiral/pages -f build_type=workflow`.
      If that fails: 🧑 Repo → Settings → Pages → Source → **GitHub Actions**.
- [x] Verify: `curl -I https://benoitguillaud.github.io/deep-time-spiral/` returns `200` (checked 2026-10-22, page and JS asset).

## 3. Vercel + custom domain (milestone M5)

- [ ] 🧑 Sign up at vercel.com with GitHub → **Add New Project** → import `deep-time-spiral`
      → framework preset **Vite** → environment variable `VITE_BASE=/`.
- [ ] Check that every PR gets a Vercel preview URL (staging) and that `main` deploys to production.
- [ ] 🧑 In Vercel → Project → **Domains**, add the subdomain (e.g. `time.<mydomain>`).
      Copy the **CNAME target that Vercel displays**. Do not use a hard-coded value.
- [ ] 🧑 In HostGator: cPanel → **Zone Editor** → add a **CNAME** record for the subdomain, pointing to that target.
- [ ] Wait for Vercel to verify the domain and issue the SSL certificate.
- [ ] Verify: `dig +short CNAME time.<mydomain>` shows the Vercel target, and `curl -I https://time.<mydomain>` returns `200`.
- [ ] 🧑 Decide whether GitHub Pages stays as a mirror or is switched off.

## Optional (M4 or later)

- [ ] 🧑 Install the Claude GitHub App on this repo (https://github.com/apps/claude) for cloud sessions or a
      Claude Code project that opens PRs.
