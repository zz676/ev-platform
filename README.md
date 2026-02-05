## EV Platform

Automated bilingual news platform for China EV content. Scrapes official sites and social feeds, runs AI translation/summarization, publishes to a Next.js 15 site, and auto-posts to X with image support and cost tracking.

### What’s Built
- Next.js 15 + TypeScript + Tailwind UI with EN/ZH locales and homepage ranking (featured + headlines + infinite more news).
- Supabase/Postgres via Prisma for posts, subscribers, metrics, AI usage, and X publication state.
- Scraper webhook that ingests structured posts, auto-approves high-score content, and triggers AI image generation + Vercel Blob storage.
- X auto-publishing utilities (media upload, tweet formatting, retry limits) and cost-aware AI service (DeepSeek primary, OpenAI fallback, Together AI image gen).
- Public data APIs for EV metrics, rankings, stocks ticker, and search.

### Run Locally
1. Prereqs: Node 18+, npm, PostgreSQL/Supabase URL; install Playwright/Chrome if you’ll run scrapers separately.
2. Copy env vars (create `.env.local`):
   - Required for web: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - AI/X/image: `DEEPSEEK_API_KEY` (primary), `OPENAI_API_KEY` (fallback + DALL·E), optional `TOGETHER_API_KEY`, `X_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_TOKEN_SECRET/X_BEARER_TOKEN`.
   - Webhook/auth: `SCRAPER_WEBHOOK_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Install deps and generate Prisma client: `npm install && npm run db:generate`.
4. Start dev server: `npm run dev` (runs Next.js with dynamic homepage queries). Tests: `npm test` (Jest), lint: `npm run lint`.

### Key Flows
- Scraper → `/api/webhook`: validates payload, dedupes by `sourceId`, auto-approves when relevance ≥ `POSTING_CONFIG.MIN_RELEVANCE_SCORE`, optionally generates AI card images, stores originals for article pages.
- Homepage (`src/app/[locale]/page.tsx`): selects featured post from last 48h/7d, pools ranked posts, dedupes titles, renders cards and infinite “More News”.
- X publishing (`src/lib/x-publication.ts`, `src/lib/twitter.ts`): tracks attempts, uploads media, formats tweets with hashtags/site link, records successes/failures for retries.
- AI cost tracking (`src/lib/ai.ts`): records text/image token usage to `AIUsage` table with source attribution.

### Repo Map
- `src/app/[locale]/*` – layouts/pages; `src/app/api/*` – data + ingestion APIs.
- `src/lib/*` – Prisma client, AI helpers, X publishing, metrics query executor, chart utils.
- `src/components/*` – homepage cards/sections, admin panels, ticker UI.
- `prisma/schema.prisma` – posts, translations, digests, metrics, AI usage, X publication, users.
- `docs/design/architecture.md` – deep architecture notes; `docs/features/*` – feature specs.

### Deployment Notes
- Designed for Vercel (SSR, cron) + Supabase. PgBouncer-friendly DB URL tuning is in `src/lib/prisma.ts`.
- Webhook signature enforced in production; ensure `SCRAPER_WEBHOOK_SECRET` is set, or ingestion will be rejected.
