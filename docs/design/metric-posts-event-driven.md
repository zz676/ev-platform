# Event-Driven Metric Posts Pipeline (Approve-to-Publish + Smarter Generation)

Last updated: 2026-02-10

This document describes the end-to-end design and operational model for generating data-driven "Metric Posts", rendering a chart image, generating an X post, and publishing to X with an approve-to-publish workflow. It also documents the Data Explorer table-name normalization used to safely execute LLM-generated Prisma queries.

This design is implemented in the repo under `src/app/api/*`, `src/lib/*`, and `.github/workflows/*`.

## Goals

1. Generate Metric Post drafts automatically when new monthly data arrives (event-driven).
2. Render a chart image (PNG) server-side, store it, and attach it to the X post.
3. Publish on approval: an admin approves a draft and the system immediately attempts to post to X.
4. Reliability: if posting fails transiently, a scheduled backstop retries approved posts.
5. Safety: Data Explorer can execute only allowlisted tables and "findMany-safe" query shapes, with table-name normalization to handle LLM casing.

## Non-Goals

1. No full queue system (no Redis/SQS) in this phase.
2. No fully generic "template engine" for every possible chart/query (this is a Phase 2 follow-up).
3. No "perfect" metric completeness detection. We use a pragmatic completeness threshold.

## Key Decisions and Tradeoffs

### Event-driven drafts vs scheduled “daily draft generation”

Decision:

1. Draft generation is triggered by the metric ingestion workflow (GitHub Action), not by a daily cron.
2. The generator endpoint is idempotent and only creates drafts when a new “complete month” appears.

Tradeoffs:

1. Pros: drafts appear soon after new data lands; fewer no-op cron runs; less DB pressure.
2. Cons: relies on the ingestion workflow to call the trigger reliably; if ingestion is paused, no new drafts appear until it resumes.

### Approve-to-publish (immediate) plus cron backstop (retries)

Decision:

1. Admin approval triggers an immediate publish attempt (fast feedback loop).
2. A scheduled backstop retries transient failures and keeps the system “hands-off”.

Tradeoffs:

1. Pros: reduces manual retries; handles flaky X/media upload/network failures common in serverless.
2. Cons: slightly more moving parts (an hourly job and a cron endpoint).

### No queue system in Phase 1

Decision:

1. Use DB state transitions + a lightweight “lock” (atomic update) for concurrency control.
2. Use a scheduled retry job rather than a dedicated queue.

Tradeoffs:

1. Pros: simpler ops; fewer services; faster iteration.
2. Cons: less precise retry scheduling and throughput control than a real job queue.

### “Latest complete month” detection

Decision:

1. Use a pragmatic completeness threshold (`METRIC_COMPLETE_MIN_BRANDS`, default `8` brands) for `DELIVERY/MONTHLY`.

Tradeoffs:

1. Pros: robust enough for early automation; easy to reason about.
2. Cons: may mis-detect completeness if data is delayed for multiple major brands; does not validate per-brand integrity.

## High-Level Overview

The system has 2 main loops:

1. Draft generation loop (event-driven):
   - Triggered by the ingestion workflow that writes EV metric data.
   - Calls `GET /api/cron/metric-posts` to generate drafts when a new "complete month" appears.

2. Publishing loop (event-driven + backstop):
   - Admin approval triggers an immediate publish attempt.
   - A scheduled job calls `GET /api/cron/metric-posts-publish` to retry approved posts.

Data flow (simplified):

```text
GitHub Action (CnEVData scraper)  --->  Vercel API: /api/cron/metric-posts  --->  MetricPost(DRAFT)

Admin approves MetricPost(DRAFT)  --->  Vercel API: PATCH /api/admin/metric-posts/[id] (approve)
                                    --->  publishMetricPost() lock -> chart -> X upload -> POSTED or APPROVED/FAILED

GitHub Action (hourly backstop)   --->  Vercel API: /api/cron/metric-posts-publish ---> publishMetricPost()
```

## Data Model

### MetricPost

Source of truth for a metric post draft and its publishing lifecycle.

Implemented in Prisma schema: `prisma/schema.prisma` (`model MetricPost`).

Key fields:

1. Identity and uniqueness
   - `id`
   - `postType`, `year`, `period`, `brand`
   - Unique key: `@@unique([postType, year, period, brand])`
   - Convention: for `ALL_BRANDS_COMPARISON`, use `brand = INDUSTRY` as a sentinel so the unique key remains valid.

2. Content and chart
   - `content`: final text to post
   - `chartImageUrl`: public URL (Vercel Blob) of the PNG chart image
   - `dataSnapshot`: JSON used for reproducibility (data at generation time)

3. Publishing lifecycle
   - `status`
   - `tweetId`, `postedAt`
   - `attempts`, `lastAttemptAt`, `lastError`
   - `approvedAt`, `approvedBy`

### MetricPostStatus

Implemented in Prisma schema: `prisma/schema.prisma` (`enum MetricPostStatus`).

States:

1. `DRAFT`: editable, not yet approved.
2. `APPROVED`: approved and awaiting posting or retry.
3. `POSTING`: lock acquired, currently attempting to post.
4. `POSTED`: successfully posted to X.
5. `FAILED`: exceeded retry attempts or a hard failure that should stop automatic retries.
6. `SKIPPED`: admin explicitly skipped.

State transitions:

```text
DRAFT -> APPROVED -> POSTING -> POSTED
DRAFT -> APPROVED -> POSTING -> APPROVED (transient failure)
DRAFT -> APPROVED -> POSTING -> FAILED (max attempts reached)
DRAFT -> SKIPPED
APPROVED -> SKIPPED
FAILED -> APPROVED (retry)
```

### PostingLog

Used to enforce a global daily posting limit shared across post types.

Implemented in Prisma schema: `prisma/schema.prisma` (`model PostingLog`).

The metric post publisher writes a `PostingLog` record with `postType = "METRIC"`.

## Storage and Chart Rendering

Chart rendering is server-side:

1. Chart generation via `chartjs-node-canvas` and `chart.js`.
2. `chartjs-plugin-datalabels` is statically imported and registered via `chartCallback` to ensure Vercel output tracing includes it.
3. The generated PNG buffer is uploaded to Vercel Blob as a public asset.
4. Charts include a “card” background with shadow, consistent padding, and a watermark `source: evjuice.net` to improve readability when posted to X.
5. Vertical bar charts draw value labels using a custom plugin to place labels at the top-right of each bar (better than default placements for your use case).

Implementation:

1. Chart code: `src/lib/charts/metric-charts.ts`
2. Blob upload: `@vercel/blob` `put()` used in:
   - `src/app/api/cron/metric-posts/route.ts`
   - `src/lib/metric-posts/publish.ts`

## Key APIs and Their Responsibilities

### Admin APIs

#### GET `/api/admin/metric-posts`

Lists metric posts for the admin UI with filters:

1. Pagination: `page`, `limit`
2. Filters: `status`, `postType`, `year`, `brand`
3. Returns grouped stats by status for UI badges.

Implementation: `src/app/api/admin/metric-posts/route.ts`

#### POST `/api/admin/metric-posts/generate`

Generates a preview (content + base64 chart image) used by the admin generator UI.

Implementation: `src/app/api/admin/metric-posts/generate/route.ts`

#### POST `/api/admin/metric-posts`

Creates or updates a draft in the DB:

1. Requires `period` for all posts.
2. Normalizes `brand = INDUSTRY` for `ALL_BRANDS_COMPARISON`.
3. Prevents editing `POSTED`, and prevents editing `APPROVED/POSTING`.
4. Saves as `DRAFT` on create/update.

Implementation: `src/app/api/admin/metric-posts/route.ts`

#### PATCH `/api/admin/metric-posts/[id]`

Approve-to-publish controller:

1. `action=approve`
   - Sets `status=APPROVED`, `approvedAt`, `approvedBy`, clears `lastError`
   - Immediately calls `publishMetricPost()` for an attempt

2. `action=retry`
   - Same as approve

3. `action=unapprove`
   - Sets back to `DRAFT`, clears approval fields and error

4. `action=skip`
   - Sets `SKIPPED`

Implementation: `src/app/api/admin/metric-posts/[id]/route.ts`

#### POST `/api/admin/metric-posts/[id]/post-to-x`

Manual posting endpoint:

1. Supports optional `text` and `chartImageBase64` override in request body.
2. Calls `publishMetricPost()` which handles locking, chart URL resolution, and publishing.

Implementation: `src/app/api/admin/metric-posts/[id]/post-to-x/route.ts`

### Cron APIs

All cron endpoints are protected by `CRON_SECRET` via `Authorization: Bearer <secret>`.

#### GET `/api/cron/metric-posts`

Event-driven draft generator, idempotent per "latest complete month".

Logic:

1. Compute "latest complete month" for delivery metrics:
   - Table: `eVMetric`
   - Filter: `metric=DELIVERY`, `periodType=MONTHLY`, `brand != INDUSTRY`
   - Candidate months: distinct `(year, period)` ordered newest-first.
   - For each candidate, compute distinct brand count.
   - Pick the newest month where brandCount >= `METRIC_COMPLETE_MIN_BRANDS` (default `8`).

2. Idempotency gate:
   - If `ALL_BRANDS_COMPARISON` already exists for `(year, month, brand=INDUSTRY)`, return success without creating duplicates.

3. Create drafts:
   - `ALL_BRANDS_COMPARISON` draft (leaderboard)
   - `BRAND_TREND` drafts for each brand with data for that year, with `period = asOfMonth` (max month in trend)

Implementation: `src/app/api/cron/metric-posts/route.ts`

Helper used for month selection: `src/lib/metric-posts/latest-complete-month.ts`

#### GET `/api/cron/metric-posts-publish`

Backstop retry publisher for approved posts.

Logic:

1. Enforce daily post limit using `PostingLog` and `POSTING_CONFIG.MAX_POSTS_PER_DAY`.
2. Take at most `METRIC_MAX_PER_RUN` posts per run (default `2`), also bounded by remaining daily limit.
3. Find `MetricPost` rows with `status=APPROVED`, ordered by `approvedAt` then `createdAt`.
4. For each, call `publishMetricPost({ expectedStatuses: [APPROVED] })`.

Implementation: `src/app/api/cron/metric-posts-publish/route.ts`

## Event Triggers (GitHub Actions)

### CnEVData ingestion triggers draft generation

Workflow:

1. File: `.github/workflows/cnevdata-scraper.yml`
2. After scraper completes (and is not a dry run), it calls:
   - `GET $VERCEL_URL/api/cron/metric-posts`
   - Header: `Authorization: Bearer $CRON_SECRET`

Secrets required:

1. `VERCEL_URL`
2. `CRON_SECRET`

### Hourly backstop triggers publish retries

Workflow:

1. File: `.github/workflows/cron-metric-posts-publish.yml`
2. Schedule: hourly
3. Calls:
   - `GET $VERCEL_URL/api/cron/metric-posts-publish`
   - Header: `Authorization: Bearer $CRON_SECRET`

Secrets required:

1. `VERCEL_URL`
2. `CRON_SECRET`

## Publisher Implementation Details

Publisher function:

1. File: `src/lib/metric-posts/publish.ts`
2. Called by:
   - Admin approve endpoint
   - Admin manual post-to-x endpoint
   - Cron publish backstop

### Locking and idempotency

To avoid double-posting in serverless concurrency, publishing acquires a lock by using `updateMany`:

1. Condition: `id = <id>` and `status IN expectedStatuses`
2. Update: set `status = POSTING`, increment `attempts`, set `lastAttemptAt`, clear `lastError`

If the lock fails (`count=0`), it returns a "skipped" result (some other request likely already processed it).

### Chart URL resolution

The publisher requires a chart image to post:

1. If `overrideChartImageBase64` is provided:
   - Decode base64 into a buffer.
   - Upload to Vercel Blob.
   - Use that URL.

2. Else, if `chartImageUrl` already exists:
   - Use it.

3. Else:
   - Generate chart from `dataSnapshot`, or fall back to a DB query to rebuild the snapshot.
   - Upload to Vercel Blob.
   - Use that URL.

### Posting to X

1. Upload chart URL to X media upload to obtain `mediaId`.
2. Post tweet with the media id list.
3. Persist:
   - `MetricPost.status=POSTED`, `tweetId`, `postedAt`, `chartImageUrl`, `content`
   - Create a `PostingLog` record for rate limiting.

### Failure and retry behavior

On error:

1. `lastError` is written.
2. Status becomes:
   - `APPROVED` (if initial state was approved) until attempts reach `METRIC_MAX_ATTEMPTS`, then `FAILED`.
   - `DRAFT` (if initial state was draft) until attempts reach `METRIC_MAX_ATTEMPTS`, then `FAILED`.

## Data Explorer Table-Name Normalization

Problem:

1. Prisma client uses camelCase keys (example: `eVMetric`).
2. LLMs and users frequently produce PascalCase (example: `EVMetric`).
3. Allowlisting and dispatching based on the raw table name fails.

Solution:

1. Normalize the incoming table name to canonical Prisma client keys.
2. Apply normalization in both the LLM query generator and the query executor.

Implementation:

1. Normalizer: `src/lib/data-explorer/table-name.ts`
2. Applied in:
   - `src/lib/llm/query-generator.ts`
   - `src/lib/query-executor.ts`
3. Prompt lists canonical names in: `src/lib/config/prompts.ts`

## Environment Variables

### Required for cron security

1. `CRON_SECRET`

### Metric pipeline tuning

1. `METRIC_COMPLETE_MIN_BRANDS` (default `8`)
2. `METRIC_MAX_ATTEMPTS` (default `2`)
3. `METRIC_MAX_PER_RUN` (default `2`)
4. `SKIP_X_PUBLISH` (set to `true` to disable publishing in a non-prod environment)

### Storage

1. `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

### X credentials

1. `X_API_KEY`
2. `X_API_SECRET`
3. `X_ACCESS_TOKEN`
4. `X_ACCESS_TOKEN_SECRET`
5. `X_BEARER_TOKEN`

### LLM credentials

This pipeline uses LLM calls for tweet text generation in `src/lib/llm/metric-posts.ts`. Configure the provider keys used by your LLM client.

## Prisma and Supabase Notes

This repo uses Prisma v7 config-based datasource:

1. Datasource URL is configured in `prisma.config.ts`.
2. `prisma/schema.prisma` does not include `datasource db { url = ... }` (Prisma v7 rejects it).

Supabase and pooling:

1. `DATABASE_URL` should point to the Supabase pooler (PgBouncer) when used in serverless.
2. `src/lib/prisma.ts` uses `@prisma/adapter-pg` with a `pg` `Pool` and sets conservative limits.

## Deployment and Operations Runbook

### Database migration (Supabase)

Because this phase changes enum values and adds columns, the DB schema must be updated before the new code can run.

Recommended approach:

1. In Supabase SQL Editor, add enum values first.
2. Run other statements in a second run after the first run is committed.

Example migration:

```sql
ALTER TYPE "MetricPostStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "MetricPostStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "MetricPostStatus" ADD VALUE IF NOT EXISTS 'POSTING';
ALTER TYPE "MetricPostStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
```

Then in a new run:

```sql
ALTER TABLE "MetricPost"
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" text,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "approvedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "approvedBy" text;

ALTER TABLE "MetricPost"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
```

If you see:

```text
unsafe use of new value "DRAFT" of enum type "MetricPostStatus"
```

It means you tried to use the new enum value in the same transaction. Run the `ALTER TYPE ... ADD VALUE` statements alone first, then run dependent statements in a separate run.

### Local development notes (charts)

Chart rendering uses the native `canvas` module. If chart generation fails locally with an “incompatible architecture” error, it usually means your installed native binary doesn’t match your CPU/Node runtime. The fix is typically to reinstall dependencies (or rebuild `canvas`) on the same machine/architecture you are running on. Production (Vercel) is the source of truth for the deployment runtime.

### Verification checklist

1. Admin UI loads Metric Posts without 500s.
2. Draft generation endpoint:
   - `GET /api/cron/metric-posts` returns "generated" or "already generated".
3. Approval posts immediately:
   - Approving a draft leads to `POSTING` then `POSTED`, or returns to `APPROVED` with `lastError`.
4. Backstop cron retries:
   - `GET /api/cron/metric-posts-publish` posts approved items up to limits.
5. GitHub Action triggers draft generation:
   - `cnevdata-scraper.yml` run includes the metric cron step.

## Test Coverage

Unit tests added:

1. Table-name normalization: `src/lib/__tests__/table-name.test.ts`
2. Latest complete month selection: `src/lib/__tests__/latest-complete-month.test.ts`

## Future Work (Phase 2)

1. Data Explorer templates:
   - Save an allowlisted query + chart spec + LLM prompt as a "template".
   - Add trigger rules (monthly, weekly, "new month detected").
2. Better completeness checks:
   - Per-brand minimum record count.
   - Detect outliers or missing major brands.
3. Queue-based reliability:
   - Optional introduction of a job queue for media upload and posting retries.

## Failure Modes and How We Handle Them

1. LLM provider outage:
   - The code uses provider fallback in `src/lib/llm/*`.
   - If all providers fail, the post remains `DRAFT`/`APPROVED` with a `lastError` (no partial publish).
2. X API transient failures (media upload/post):
   - On failure, `publishMetricPost()` writes `lastError` and returns the post to `APPROVED` for retry (until `METRIC_MAX_ATTEMPTS`).
3. Blob token missing:
   - Publishing can proceed without Blob in some flows (depending on whether the chart URL already exists and whether you upload media by URL vs buffer).
   - For consistent behavior across environments, configure `BLOB_READ_WRITE_TOKEN` in production.
4. Serverless concurrency (double publish risk):
   - Mitigated by the `POSTING` lock acquired via atomic `updateMany` with expected statuses.
5. Database pool exhaustion:
   - Avoid long transactions; keep Prisma queries lean; prefer pooler URL in serverless.

## Observability

1. Primary signals:
   - `MetricPost.status`, `attempts`, `lastAttemptAt`, `lastError`, `tweetId`, `postedAt`
2. Logs:
   - Vercel function logs for the cron/admin routes
3. Operational checks:
   - If `APPROVED` posts are stuck, run the backstop endpoint and inspect `lastError`.
