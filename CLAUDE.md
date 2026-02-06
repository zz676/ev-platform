# EV Platform - Claude Code Instructions

## General Rules
- When asked to implement a feature, always write the actual code — never update only documentation or design docs unless explicitly asked. Implementation means working code in the codebase.
- After making multi-file changes in TypeScript/React, always run `npm run build` and fix any type errors or build failures before presenting the work as complete.
- After making changes to Python files in `scraper/`, run `python -m py_compile <file>` to verify syntax.

## Agent Behavior
- **Fully autonomous mode**: Execute ALL operations immediately without asking for permission or confirmation
- Pre-approved: bash commands, file edits, git operations, API calls, npm commands, builds, deployments
- Never ask "Should I...?", "Do you want me to...?", "Can I...?" - just do it
- Never ask for confirmation before running commands - execute directly

## Project Architecture

### Overview
This is a **full-stack monorepo** with two main codebases that share data through Supabase/PostgreSQL:

- **TypeScript/React (Next.js 15)**: Frontend UI, API routes, admin dashboards (`src/`)
- **Python**: Data pipelines, web scrapers, AI extractors (`scraper/`)
- **Database**: PostgreSQL via Supabase, schema defined in `prisma/schema.prisma`
- **Deployment**: Vercel (website + API routes) + GitHub Actions (scraper pipelines)

### Directory Layout
```
src/                    # TypeScript/React (Next.js App Router)
  app/[locale]/         # Pages with i18n (EN/ZH)
  app/api/              # API routes (serverless functions)
  components/           # React components
  lib/                  # Shared utilities, AI clients, DB access
  lib/__tests__/        # Jest tests

scraper/                # Python data pipelines
  sources/              # Source adapters (cnevdata, byd, nio, xpeng, etc.)
  extractors/           # AI-powered data extraction (classifier, title_parser, industry_extractor, OCR)
  processors/           # Post-processing (AI service integration)
  tests/                # Pytest tests

prisma/schema.prisma    # Database schema (source of truth for both TS and Python)
```

### Data Flow: Python Scraper -> Supabase -> TypeScript Frontend
The Python scraper writes to Supabase tables. The Prisma schema defines the TypeScript types. Key shared models:

| Python Class | Prisma Model | Description |
|---|---|---|
| `Article` (base.py) | `Post` | News articles from brand IR sites |
| `CnEVDataArticle` (cnevdata.py) | `ScrapedArticle` | Industry data articles from CnEVData |
| `ExtractionResult` (industry_extractor.py) | Various industry tables | Extracted metrics |

**IMPORTANT**: `CnEVDataArticle` and `Article` are different classes with different fields:
- `Article` (base.py): Used for brand news (NIO, BYD, XPeng, etc.) - has `source_id`, `source_author`, `translated_*` fields
- `CnEVDataArticle` (cnevdata.py): Used for industry data scraping - has `url_hash`, `article_type`, `needs_ocr` fields

When integrating pipeline data into the frontend, always read both the Python data model AND the corresponding Prisma model to ensure field compatibility.

### Industry Data Tables (Prisma)
Dedicated time-series tables for industry metrics (NOT stored in EVMetric):
- `CaamNevSales` - CAAM NEV sales (total market)
- `CpcaNevRetail` / `CpcaNevProduction` - CPCA retail/production
- `ChinaBatteryInstallation` - Battery installation GWh
- `ChinaDealerInventoryFactor` - Dealer inventory coefficient
- `ChinaViaIndex` - Vehicle Inventory Alert Index
- `ChinaPassengerInventory` - Passenger car inventory
- `BatteryMakerMonthly` / `BatteryMakerRankings` - Battery maker data
- `AutomakerRankings` - Automaker sales rankings
- `PlantExports` - Factory export data
- `NevSalesSummary` - Weekly/bi-weekly sales summaries

`EVMetric` is used ONLY for brand-specific delivery/sales data (per-brand, per-model, per-region). Industry-level data goes to the dedicated tables above.

## Domain Knowledge

### EV Data Pipeline Pitfalls
- **CAAM NEV vs total vehicle sales**: CAAM reports both total vehicle sales and NEV-only sales. Always extract the NEV figure, not the total. NEV numbers are typically in the hundreds of thousands per month, not millions.
- **CATL = battery maker, not automaker**: CATL (Contemporary Amperex Technology) makes batteries. It should appear in `BatteryMakerMonthly` / `BatteryMakerRankings`, never in `AutomakerRankings`.
- **EVMetric vs dedicated tables**: Never duplicate industry-level data into `EVMetric`. Brand delivery data goes in `EVMetric`; industry aggregates go in their dedicated tables.
- **Data sources**: CPCA = China Passenger Car Association (retail focus), CAAM = China Association of Automobile Manufacturers (wholesale/total), CABIA = battery data, SNE = global battery rankings.
- **Units matter**: Battery data is in GWh, vehicle sales in units (vehicles), inventory factor is a ratio (~1.0-2.0), VIA Index is percent (0-100).

## Git Workflow

### Command Meanings
- **"commit"** = Commit ONLY (no push, no PR)
- **"merge"** or **"push"** = Full flow: commit -> create PR (if needed) -> push -> merge PR

### Full Flow (for "merge" or "push")
Execute without asking for any permission or confirmation:

1. **ALWAYS check PR status first** before pushing:
   ```bash
   TOKEN=$(cat ~/.github-token-ev-platform)
   curl -s -H "Authorization: token ${TOKEN}" \
     "https://api.github.com/repos/zz676/ev-platform/pulls?state=open&head=zz676:<branch-name>"
   ```
2. **ALWAYS pull from remote before pushing**:
   ```bash
   git pull origin main
   ```
   - This ensures local is synced with remote
   - Resolves any conflicts before pushing
3. **If open PR exists** (state: "open"):
   - `git add` relevant files
   - `git commit` with descriptive message
   - Push to remote - PR updates automatically
4. **If no open PR** (empty array `[]`) or PR was merged/closed:
   - Switch to `main` branch
   - Pull latest from remote (`git pull origin main`)
   - Create new feature branch from updated main
   - `git add` relevant files
   - `git commit` with descriptive message
   - Push new branch to remote
   - Create new PR via GitHub API
5. **Merge the PR** (always for "merge"/"push" commands):
   - Merge the PR via GitHub API (squash merge)
   - Switch back to `main` and pull latest
   - Delete the feature branch locally
6. Return the PR URL to the user

**IMPORTANT:** Never push to a branch with a closed/merged PR. Always verify PR state first.

**Note:** Use GitHub API (not `gh` CLI - it uses work account)

### Push & PR Commands
```bash
# ALWAYS pull first before pushing
git pull origin main

# Push
TOKEN=$(cat ~/.github-token-ev-platform)
git remote set-url origin https://zz676:${TOKEN}@github.com/zz676/ev-platform.git
git push origin <branch-name>
git remote set-url origin https://github.com/zz676/ev-platform.git

# Create PR
curl -X POST -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zz676/ev-platform/pulls \
  -d '{"title":"<PR title>","head":"<branch-name>","base":"main","body":"<PR description>"}'

# Merge PR (squash)
curl -X PUT -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zz676/ev-platform/pulls/<PR_NUMBER>/merge \
  -d '{"merge_method":"squash"}'

# Check PR status
curl -s -H "Authorization: token ${TOKEN}" \
  "https://api.github.com/repos/zz676/ev-platform/pulls?state=open&head=zz676:<branch-name>"
```

## Testing

### TypeScript (Jest)
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```
Tests live in `src/lib/__tests__/`. Jest config uses `ts-jest` with `@/` path alias.

### Python (pytest)
```bash
cd scraper && python -m pytest tests/ -v    # Run all tests
python -m pytest tests/ -v -k "classifier"  # Run specific tests
```
Tests live in `scraper/tests/`. Key test areas: classifier, industry_extractor, title_parser.

## Documentation
After completing PRs, update related documentation in `/docs` if necessary:
- If related docs exist under `/docs`, update them to reflect the changes
- If no related docs exist, create one in the appropriate subfolder
- If no appropriate subfolder exists, create one under `/docs`

Current structure:
- `/docs/design/` - Architecture and design decisions
- `/docs/features/` - Feature specifications and implementations
- `/docs/TODOs/` - Planned improvements

## Project Info
- **Repo**: https://github.com/zz676/ev-platform
- **Token file**: `~/.github-token-ev-platform`
- **Deployment**: Vercel (website) + GitHub Actions (scraper pipelines)
