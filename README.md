## EV Platform (EV Juice)

Automated bilingual news platform for China EV content. Scrapes official sites and industry data, runs AI translation and summarization, publishes to a Next.js 15 site, and auto-posts to X with image support and cost tracking.

**Live site:** [evjuice.net](https://evjuice.net) · **Brand overlay:** [juiceindex.io](https://juiceindex.io)

### Monorepo layout

| Path | Stack | Role |
|------|-------|------|
| `src/` | Next.js 15, TypeScript, Tailwind | Bilingual UI, API routes, admin, cron |
| `scraper/` | Python | Brand IR scrapers, CnEVData pipelines, extractors |
| `prisma/` | Prisma 7 | Postgres schema (shared by web + scraper) |
| `.github/workflows/` | GitHub Actions | Scheduled scrapers, digest, X publish, metric posts |

See [`scraper/README.md`](scraper/README.md) for Python setup and CLI usage.

### What’s built

- Next.js 15 + TypeScript + Tailwind UI with EN/ZH locales (`next-intl`) and homepage ranking (featured + headlines + infinite “More News”).
- Supabase/Postgres via Prisma for posts, industry metrics, subscribers, AI usage, and X publication state.
- Scraper webhook that ingests structured posts, auto-approves high-score content, and triggers AI image generation + Vercel Blob storage.
- X auto-publishing (media upload, VIP + digest scheduling, retry limits) with **juiceindex.io** logo overlay on post images.
- AI stack: DeepSeek (primary text), OpenAI (fallback text + **GPT Image 1 Mini** cards), usage tracked in `AIUsage`.
- Six randomized cinematic car image styles (formula, muscle, hypercar, roadster, rally, cyberpunk), each with variation pools for angle, setting, color, and detail.
- Public data APIs for EV metrics, rankings, stocks ticker, and search.

### Run locally (web)

1. **Prereqs:** Node 20+ (`nvm use` reads `.nvmrc`), npm, Supabase/Postgres URLs.
2. **Env:** copy `.env.example` → `.env.local` and fill in values. Minimum for the app:
   - Database: `DATABASE_URL`, `DIRECT_URL`
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - AI: `DEEPSEEK_API_KEY`, `OPENAI_API_KEY` (required for image generation)
   - Ingestion: `SCRAPER_WEBHOOK_SECRET`, `CRON_SECRET`
   - Site: `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_SITE_NAME`
   - X (optional locally): `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`
   - Blob (production images): `BLOB_READ_WRITE_TOKEN`
3. **Install & DB client:** `npm install && npm run db:generate`
4. **Dev:** `npm run dev` · **Tests:** `npm test` · **Lint:** `npm run lint` · **Build:** `npm run build`

Posting thresholds are configured via env (see `.env.example`): `X_VIP_THRESHOLD`, `X_MIN_RELEVANCE_SCORE`, `X_MAX_POSTS_PER_DAY`, `X_MAX_VIP_PER_RUN`.

### Run locally (scraper)

```bash
cd scraper
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# .env with DEEPSEEK_API_KEY, OPENAI_API_KEY, WEBHOOK_URL, SCRAPER_WEBHOOK_SECRET
python main.py --dry-run
```

Scrapers can also run on a schedule via GitHub Actions (see `.github/workflows/scraper.yml` and related workflows).

### Key flows

- **Scraper → `/api/webhook`:** validates payload, dedupes by `sourceId`, auto-approves when relevance ≥ `POSTING_CONFIG.MIN_RELEVANCE_SCORE`, optionally generates AI card images (random style + variations), applies branding overlay, stores originals for article pages.
- **Homepage** (`src/app/[locale]/page.tsx`): selects featured post from last 48h/7d, pools ranked posts, dedupes titles, renders cards and infinite “More News”.
- **X publishing** (`src/lib/x-publication.ts`, `src/lib/twitter.ts`): VIP checks and digests, media upload, hashtags + site link, success/failure tracking for retries.
- **AI** (`src/lib/ai.ts`): text completion with cost tracking; image generation via GPT Image 1 Mini + `applyBrandingOverlay`.

### Repo map

- `src/app/[locale]/*` — layouts/pages; `src/app/api/*` — data, ingestion, cron APIs.
- `src/lib/*` — Prisma client, AI, X publishing, metrics, charts, auth.
- `src/components/*` — homepage, admin, ticker UI.
- `scraper/sources/` — brand IR adapters; `scraper/extractors/` — industry/OCR pipelines.
- `prisma/schema.prisma` — posts, translations, industry tables, AI usage, X publication.
- `docs/design/architecture.md` — architecture notes; `docs/features/*` — feature specs; `AGENTS.md` — agent/dev conventions.

### Deployment

- **Web:** Vercel (SSR + cron routes). PgBouncer-friendly DB tuning in `src/lib/prisma.ts`.
- **Scrapers:** GitHub Actions (no Vercel Hobby cron limit); optional Railway for long-running scheduler.
- **Secrets:** webhook signature enforced in production — set `SCRAPER_WEBHOOK_SECRET` or ingestion is rejected.
