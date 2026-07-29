# Triply CMS — CLAUDE.md (shared team contract)

> **Committed to the `triply-cms` repo and read automatically by everyone's
> Claude Code when working here.** It's the shared source of truth for *how we
> work on this repo together*.
>
> This is a **separate repo** from the main app (`triply`). When you work here,
> only *this* file loads — so the dev-flow is restated below rather than pointed
> at the app repo's copy. For Payload *framework* patterns (access control, type
> generation, hooks), see the existing [`AGENTS.md`](AGENTS.md) — this file is
> about process, not framework code.

---

## What this repo is

The **Payload CMS** (Payload 3, port 3001 in dev) that stores Triply's blog
content — posts, categories, tags, media. It deploys to **cms.triplypro.com**.
The blog engine that generates content lives in the *other* repo
(`triply/scripts/blog-engine/`) and writes into this CMS over its API.

| | |
|---|---|
| GitHub | `tomdro61/triply-cms` (public) |
| Deploys to | cms.triplypro.com |
| DB | Supabase Postgres — **the same production project the app uses** |

---

## 🚨 Git & dev workflow

Same model as the app repo: **`main` is the source of truth; work on
short-lived `feat/*` branches cut from `main`.** Never commit work directly to
`main`.

### Start-of-task ritual — before writing any code

```bash
git checkout main && git pull
git checkout -b feat/<short-name>
```

### The flow

1. Cut a `feat/*` branch off the latest `main`.
2. Develop + commit on the branch. Before pushing: `npx tsc --noEmit` (and
   regenerate types + import map after schema changes — see AGENTS.md).
3. Push the branch, open a PR into `main` (`gh pr create --base main`).
4. Merge the PR.

> ⚠️ **This repo has no staging environment.** A merge to `main` deploys
> **straight to production** (cms.triplypro.com). There's no soak step, so test
> locally *before* merging and keep PRs small. Higher-stakes than the app repo,
> which does have a staging soak.

---

## 🤝 Working together (two devs, no collisions)

- **Always `git pull` `main` before branching.** One feature branch per task; never two people on one branch.
- **Ownership:** Vin owns CMS collections + blog content; Tom owns app/payments. Coordinate (Discord) before touching each other's areas.
- **Small, frequent PRs** — fewer merge conflicts.

---

## ⚠️ Content is production (the big one)

This CMS's database is a **single shared production store** — there is no
separate "staging" content, and the blog engine can write to it directly. So:

- **Editing a collection schema or content here affects the live blog immediately** once deployed.
- **Blog posts have a `status` field (`draft` / `review` / `published`).** That status — not a git branch — is the content review gate. Content isn't public until it's `published`. Generate/create as draft, review in the Payload admin, then publish.
- When the blog engine runs against this CMS (`PAYLOAD_CMS_URL=https://cms.triplypro.com`), it's writing to prod. Coordinate who runs generation.

---

## 🔐 Security (this repo is PUBLIC + access-control is critical)

- **Never commit secrets.** `.env.local` holds `PAYLOAD_SECRET`, `DATABASE_URI`, and API keys — it must stay gitignored.
- **Access control is security-critical.** This CMS's public API + an over-permissive `Users` collection were the root of the 2026 Supabase egress incident (bots pulling the posts table; anyone able to create an admin). When touching `access/` or collection `access` rules, be deliberate — default to locked-down, and never widen `read`/`create` without a reason.
- Follow the access-control and transaction-safety rules in [`AGENTS.md`](AGENTS.md).

---

## Common commands

```bash
npm run dev -- -p 3001          # CMS admin on :3001
npx tsc --noEmit                # typecheck before pushing
npx payload generate:types      # after changing a collection schema
npx payload generate:importmap  # after adding/changing admin components
```

---

*Shared team CLAUDE.md — committed to the `triply-cms` repo. Payload framework
patterns live in `AGENTS.md`; this file is the team dev process. Last updated:
July 23, 2026.*
