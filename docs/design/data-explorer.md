# Data Explorer (LLM-Assisted, Safe Query + Chart + Post Builder)

Last updated: 2026-02-10

This document explains what the Data Explorer solves, how it works, and why the design is intentionally constrained. It also outlines how to productize this into a SaaS tool where the core differentiation is your data, but the product includes a safe, pleasant way for users to explore it.

## What Problem Does It Solve?

### For users

1. **“I want an answer, not a dashboard.”**
   - Users often want one-off questions answered quickly (e.g., “Top brands by deliveries in 2026”, “CATL vs BYD installations 2024”).
   - Traditional BI tools require learning schemas, writing SQL, or navigating fixed dashboards.

2. **“I want to verify the result.”**
   - LLM answers alone are not trustworthy.
   - Data Explorer shows the generated query, lets users edit it, executes it against the real DB, and shows rows + a chart.
   - It also shows a **SQL preview** for copy/paste into Postgres tools.

3. **“I want output I can share.”**
   - Users want charts and narrative summaries for social posts, internal memos, or reports.
   - Data Explorer generates a chart image (PNG) and can generate post text using an editable prompt.

### For the platform

1. **Self-serve discovery of data value**
   - Instead of hand-building every chart, you provide a constrained “query workbench” that maps users to your datasets.

2. **Controlled surface area**
   - This is not “LLM has DB access”.
   - It is “LLM suggests a read-only, allowlisted, validated Prisma `findMany` query shape” plus strict limits.

## User Flow (Product)

Implemented in `src/app/[locale]/admin/data-explorer/page.tsx`.

1. Step 1: Ask a question (natural language)
   - UI: `src/components/admin/DataExplorer/QueryInput.tsx`
   - Calls: `POST /api/admin/data-explorer/generate-query`

2. Step 2: Review / Edit Query
   - UI: `src/components/admin/DataExplorer/QueryEditor.tsx`
   - Shows:
     - Canonical table name (Prisma client key)
     - Editable JSON query (Prisma `findMany` subset)
     - SQL preview tab (runnable Postgres SQL approximation)
     - Copy/format tools
   - Calls: `POST /api/admin/data-explorer/execute-query`

3. Step 3: View results, generate chart, generate post
   - Results: `src/components/admin/DataExplorer/ResultsTable.tsx`
   - Chart: `src/components/admin/DataExplorer/ChartPreview.tsx`
     - Calls: `POST /api/admin/data-explorer/generate-chart`
   - Post: `src/components/admin/DataExplorer/PostComposer.tsx`
     - Shows an editable prompt and generated content
     - Calls: `POST /api/admin/data-explorer/generate-post`

## Architecture Overview

At a high level:

```text
Browser (Admin UI)
  |
  | 1) question
  v
POST /api/admin/data-explorer/generate-query
  - LLM generates: { table, prismaFindManyJson, chartType, chartTitle, explanation }
  - table-name normalization
  |
  | 2) user edits JSON
  v
POST /api/admin/data-explorer/execute-query
  - allowlist + validation + timeouts + row limits
  - prisma.findMany(...)
  |
  | 3) chart + post
  v
POST /api/admin/data-explorer/generate-chart
  - server-side Chart.js render (PNG)

POST /api/admin/data-explorer/generate-post
  - LLM turns prompt + data summary into short narrative
```

### Frontend (Next.js)

1. App Router page:
   - `src/app/[locale]/admin/data-explorer/page.tsx`
2. Client components:
   - `src/components/admin/DataExplorer/*`
3. Why a step-based UI:
   - It forces a review step between “LLM suggestion” and “DB execution”.
   - It keeps the mental model simple: question -> query -> results -> chart/post.

### Backend APIs (Next.js Route Handlers)

All Data Explorer APIs require admin auth via `requireApiAdmin()`:

1. Query generation:
   - `src/app/api/admin/data-explorer/generate-query/route.ts`
2. Safe execution:
   - `src/app/api/admin/data-explorer/execute-query/route.ts`
3. Chart rendering:
   - `src/app/api/admin/data-explorer/generate-chart/route.ts`
4. Post generation:
   - `src/app/api/admin/data-explorer/generate-post/route.ts`
   - `export const runtime = "nodejs";` (native deps and predictable execution)

### LLM Query Generator (Design)

Implemented in `src/lib/llm/query-generator.ts`.

Inputs:

1. Natural language question
2. Prompt that lists allowed tables/fields and rules:
   - `src/lib/config/prompts.ts` (`QUERY_GENERATOR_PROMPT`)
3. Live DB hints (optional):
   - Fetches recent years/brands to make the model pick realistic filters
   - Cached for a short window to reduce DB load

Outputs:

1. `table`: canonical Prisma client model key (camelCase)
2. `query`: Prisma `findMany`-compatible JSON (subset)
3. `chartType` + `chartTitle`
4. `explanation`: human-readable statement of intent

Reliability:

1. Uses provider fallback (DeepSeek first when configured, otherwise OpenAI).
2. Enforces time budgets to avoid serverless timeouts.

### Safe Query Executor (Core Safety Layer)

Implemented in `src/lib/query-executor.ts`.

Key safety constraints:

1. **Allowlisted tables only**
   - The executor supports a specific set of read-only tables (time series + rankings + specs).
2. **Allowlisted query keys**
   - Only `where`, `orderBy`, `take`, `skip`, `select`, `distinct`
3. **Result limit**
   - `take` is clamped to `MAX_RESULTS` (default 1000)
4. **Timeout**
   - Hard timeout (default 5s) to protect DB pool and serverless runtime
5. **No raw SQL**
   - Explicitly blocks patterns that look like `$queryRaw`, `delete`, `update`, etc.

Table name normalization:

1. Problem: users/LLMs commonly output `EVMetric` but Prisma client expects `eVMetric`.
2. Fix: normalize any incoming `table` string to canonical Prisma client keys.
3. Implemented in `src/lib/data-explorer/table-name.ts`.

### SQL Preview (Trust + Portability)

Implemented in `src/lib/data-explorer/sql-preview.ts`.

Purpose:

1. Gives users a runnable SQL version for verification, sharing, and debugging.
2. Makes Data Explorer feel less “magic” and more like a developer tool.

Important limitation:

1. Prisma semantics don’t map 1:1 to SQL (especially `distinct` and nested filters).
2. The preview is “close enough” for most queries, but is explicitly labeled as a preview.

### Chart Rendering (Server-side PNG)

Implemented in:

1. Renderer: `src/lib/charts/metric-charts.ts`
2. API: `src/app/api/admin/data-explorer/generate-chart/route.ts`

Tech:

1. `chart.js` + `chartjs-node-canvas`
2. `chartjs-plugin-datalabels` (statically registered for bundling reliability)
3. Native `canvas` backing

Why server-side:

1. Produces consistent, shareable PNGs suitable for X.
2. Avoids client font/layout differences.

Design details:

1. Standard 16:9 size (good for X)
2. Card-style background + shadow for readability on social feeds
3. Watermark attribution: `source: evjuice.net`

### Post Generation (LLM)

Implemented in:

1. API: `src/app/api/admin/data-explorer/generate-post/route.ts`
2. LLM helper: `src/lib/llm/data-explorer-post.ts`

Key product choice:

1. The prompt is visible and editable before generation.
2. This avoids “mystery prompts” and lets power users tune voice and constraints.

## Technologies Used

1. Next.js App Router (UI + APIs)
2. React client components for the step flow
3. Prisma + Postgres (Supabase)
4. LLM providers:
   - DeepSeek (when configured)
   - OpenAI `gpt-4o-mini` fallback
5. Chart stack:
   - `chart.js`, `chartjs-node-canvas`, `chartjs-plugin-datalabels`

## Why This Could Be a SaaS Product

Your differentiator is the data, but Data Explorer is the “value extraction layer”. If you sell access to the dataset, you need an interface that converts “I have a question” into “here’s a verified chart and a narrative”.

### What you can sell

1. Data API access (raw data for developers)
2. Data Explorer UI access (for analysts/operators)
3. “Shareables”: exported charts and auto-written summaries/posts

### What needs to change for SaaS (multi-tenant)

1. Authentication + tenant isolation
   - Current implementation is admin-only for a single app.
   - SaaS needs orgs, roles, and dataset entitlements.

2. Data isolation models (choose one)
   - Separate DB per tenant (simple mental model, higher ops)
   - Shared DB + RLS (Postgres policies, more complex)
   - Shared DB + app-layer filtering (simpler, riskier)

3. Quotas and billing
   - Per-tenant limits for:
     - query executions
     - rows returned
     - chart renders
     - LLM tokens
   - You already have `AIUsage` tracking in Prisma which is a good base for cost accounting.

4. Safety hardening for external users
   - Stronger query validation beyond key allowlists:
     - validate allowed fields per table
     - cap `skip` to prevent expensive scans
     - enforce required filters on large tables (e.g., year/month bounds)
   - Request auditing:
     - store who ran what query and when

5. Prompt/catalog UX
   - External users need:
     - dataset catalog and schema browsing
     - examples and saved queries
     - templates (Phase 2) for recurring reports

## Tradeoffs and Current Limitations

1. Not a general SQL workbench
   - This is intentionally constrained to `findMany`-style reads on allowlisted tables.

2. LLM output correctness is not guaranteed
   - The product relies on a review/edit step and real execution results.

3. SQL preview is an approximation
   - Useful for transparency, but not guaranteed identical to Prisma behavior.

4. Native chart dependencies can be annoying locally
   - Server-side rendering relies on native `canvas`.

## Roadmap (If You Want to SaaS-ify It)

1. Multi-tenant auth + dataset entitlements
2. Saved queries + query templates
3. Template triggers (monthly/weekly/on-ingestion) that generate reports automatically
4. Audit logs + usage dashboards + billing
5. External API keys for programmatic access (paired with the UI)

