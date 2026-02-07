# CnEVData Scraper & EV Sales Data Pipeline

> **Last Updated**: February 7, 2026
> **Status**: Implemented

## Overview

A data pipeline to scrape EV sales/delivery data from cnevdata.com, storing structured metrics in the database. Supports monthly/quarterly/yearly metrics with brand, model, and regional breakdowns.

### Key Features

| Feature | Description |
|---------|-------------|
| **Title Parsing** | Extract metrics from article titles (brand, value, period, YoY/MoM changes) |
| **Article Classification** | Auto-classify articles to determine processing strategy |
| **OCR Support** | GPT-4o Vision for extracting data from table images |
| **Anti-Detection** | User-Agent rotation, random delays, rate limiting |
| **Deduplication** | Track scraped articles to prevent duplicate processing |
| **Historical Backfill** | Batch scraping with checkpoint resume support |
| **Parallel Processing** | Concurrent article processing with configurable worker count |

---

## Data Source Analysis

### cnevdata.com

CnEVData is a Substack-based publication providing detailed China EV market data.

**Accessible (Free)**:
- Article titles with numeric data
- Summary previews
- Publication dates
- Preview images (containing tables)

**Requires Subscription ($25/month)**:
- Full article content
- HTML tables inside articles

### Extraction Strategy

Most delivery/sales data is extractable from titles alone:

```
Title: "Xpeng deliveries in Jan: 20,011"
Extracted:
  - Brand: XPENG
  - Metric: DELIVERY
  - Year: 2025
  - Month: 1
  - Value: 20,011

Summary: "down 34.07% year-on-year and down 46.65% month-on-month"
Extracted:
  - YoY Change: -34.07%
  - MoM Change: -46.65%
```

For articles without numbers in titles (rankings, data tables), OCR extracts data from preview images.

---

## Database Schema

### Core Tables

```
┌─────────────────────────────────────────────────────────────────┐
│                    EV DATA TABLES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────────┐                  │
│  │   EVMetric   │ ◀────── │  EVMetricSource  │                  │
│  │              │         │  (audit trail)    │                  │
│  │  - brand     │         └──────────────────┘                  │
│  │  - metric    │                                                │
│  │  - period    │                                                │
│  │  - value     │                                                │
│  │  - yoyChange │                                                │
│  │  - momChange │                                                │
│  └──────────────┘                                                │
│                                                                  │
│  ┌──────────────┐         ┌──────────────────┐                  │
│  │ VehicleSpec  │ ◀────── │ VehicleSpecSource│                  │
│  │              │         │  (audit trail)    │                  │
│  │  - brand     │         └──────────────────┘                  │
│  │  - model     │                                                │
│  │  - battery   │                                                │
│  │  - range     │                                                │
│  └──────────────┘                                                │
│                                                                  │
│  ┌────────────────────┐                                          │
│  │  ScrapedArticle    │  (deduplication)                        │
│  │                    │                                          │
│  │  - sourceUrl       │                                          │
│  │  - status          │                                          │
│  │  - articleType     │                                          │
│  │  - needsOcr        │                                          │
│  └────────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### EVMetric Model

Stores all EV sales/delivery metrics with flexible dimensions:

| Field | Type | Description |
|-------|------|-------------|
| `brand` | Brand enum | BYD, NIO, XPENG, LI_AUTO, ZEEKR, XIAOMI, TESLA_CHINA, OTHER_BRAND, INDUSTRY |
| `metric` | MetricType enum | DELIVERY, SALES, WHOLESALE, PRODUCTION, BATTERY_INSTALL, etc. |
| `periodType` | PeriodType enum | MONTHLY, QUARTERLY, YEARLY |
| `year` | Int | Year (e.g., 2025) |
| `period` | Int | 1-12 for monthly, 1-4 for quarterly, 1 for yearly |
| `value` | Float | Primary numeric value |
| `yoyChange` | Float? | Year-over-year change % |
| `momChange` | Float? | Month-over-month change % |
| `vehicleModel` | String? | Model name (e.g., "Model Y", "ET7") |
| `region` | String? | Geographic region (e.g., "Shanghai") |
| `category` | String? | Category (e.g., "NEV", "BEV", "PHEV") |
| `dataSource` | String? | Source identifier (e.g., "CPCA", "OFFICIAL") |
| `confidence` | Float | Data confidence (1.0 for parsed, 0.9 for OCR) |

### VehicleSpec Model

Stores vehicle specifications:

| Field | Type | Description |
|-------|------|-------------|
| `brand` | Brand enum | Vehicle brand |
| `model` | String | Model name |
| `variant` | String | Trim/variant |
| `vehicleType` | VehicleType enum | BEV, EREV, PHEV, HEV |
| `startingPrice` | Float? | Starting price (RMB) |
| `batteryCapacity` | Float? | Battery capacity (kWh) |
| `rangeCltc` | Int? | CLTC range (km) |
| `acceleration` | Float? | 0-100 km/h (seconds) |
| `motorPowerKw` | Int? | Motor power (kW) |
| `lengthMm`, `widthMm`, `heightMm`, `wheelbaseMm` | Int? | Dimensions |

---

## Architecture

### Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CNEVDATA SCRAPER FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Scrape    │ ──▶ │  Classify   │ ──▶ │  Extract    │       │
│  │   Listing   │     │  Article    │     │  Metrics    │       │
│  └─────────────┘     └──────┬──────┘     └──────┬──────┘       │
│                             │                    │               │
│                    ┌────────┴────────┐          │               │
│                    │                 │          │               │
│                    ▼                 ▼          │               │
│           ┌──────────────┐ ┌──────────────┐    │               │
│           │ Has Numbers? │ │ Needs OCR?   │    │               │
│           │ Parse Title  │ │ GPT-4o Vision│    │               │
│           └──────┬───────┘ └──────┬───────┘    │               │
│                  │                │             │               │
│                  └───────┬────────┘             │               │
│                          │                      │               │
│                          ▼                      │               │
│                 ┌──────────────────┐            │               │
│                 │  Store in DB     │ ◀──────────┘               │
│                 │  (EVMetric or    │                            │
│                 │   VehicleSpec)   │                            │
│                 └──────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Article Classification

The classifier routes articles to specialized tables based on their content type:

#### Brand/Model Level (EVMetric)

| Type | Example Title | OCR? | Target Table |
|------|---------------|------|--------------|
| BRAND_METRIC | "Xpeng deliveries in Jan: 20,011" | No | EVMetric |
| MODEL_BREAKDOWN | "Tesla Apr sales breakdown: 13,196 Model 3s" | No | EVMetric |
| REGIONAL_DATA | "Shanghai Apr NEV license plates: 45,000" | No | EVMetric |
| VEHICLE_SPEC | "NIO EC7: Main specs" | Yes | VehicleSpec |

#### Industry Data Tables (12 Specialized Tables)

Articles are classified with an explicit `ocr_data_type` field that distinguishes chart images (skip OCR) from table images (do OCR):

**Chart-type articles** (`ocr_data_type="chart"`) — OCR skipped, data extracted from title:

| Type | Example Title | Target Table |
|------|---------------|--------------|
| CHINA_VIA_INDEX | "VIA index rises to 59.4%" | ChinaViaIndex |
| CHINA_DEALER_INVENTORY_FACTOR | "Dealer inventory factor rises to 1.31" | ChinaDealerInventoryFactor |
| CHINA_PASSENGER_INVENTORY | "China passenger car inventory: 3.2M units" | ChinaPassengerInventory |
| CHINA_BATTERY_INSTALLATION | "China EV battery installations: 45.2 GWh" | ChinaBatteryInstallation |
| CAAM_NEV_SALES | "CAAM NEV sales: 1.2 million in Jan" | CaamNevSales |
| CPCA_NEV_RETAIL | "CPCA: NEV retail sales reach 850,000" | CpcaNevRetail |
| CPCA_NEV_PRODUCTION | "CPCA: NEV production hits 920,000" | CpcaNevProduction |
| BATTERY_MAKER_MONTHLY | "CATL battery installations: 25.6 GWh" | BatteryMakerMonthly |
| PLANT_EXPORTS | "Tesla Shanghai exports 35,000" | PlantExports |

**Table-type articles** (`ocr_data_type="rankings"/"trend"/"specs"`) — OCR used for data extraction:

| Type | Example Title | OCR Type | Target Table |
|------|---------------|----------|--------------|
| AUTOMAKER_RANKINGS | "CPCA top-selling automakers Jan 2025" | rankings | AutomakerRankings |
| BATTERY_MAKER_RANKINGS | "Top battery makers China Jan 2025" | rankings | BatteryMakerRankings |
| NEV_SALES_SUMMARY | "NEV sales Jan 1-18 reach 420,000" | trend | NevSalesSummary |

---

## Industry Data Pipeline Integration

### Architecture

The scraper routes articles to specialized **industry data tables** via title parsing and optional OCR. Chart-type articles have their key data point extracted from the title; table-type articles use OCR for structured data extraction.

**Image URL Normalization**: The source adapter normalizes preview image URLs (used by OCR and industry extraction). CnEVData images may be extracted as relative paths (e.g. `/uploads/chart.jpg`). The adapter prepends the `base_url` (`https://cnevdata.com`) to relative paths, matching the existing article URL normalization pattern.

### New Components

| File | Purpose |
|------|---------|
| `extractors/industry_extractor.py` | Extract structured data for 12 table types |
| `api_client.py` | HTTP client for submitting to industry table APIs |
| `config.py` | Added `API_BASE_URL` configuration |
| `main.py` | Added `process_industry_data()` function |

### Industry Data Extraction

The `IndustryDataExtractor` extracts table-specific fields:

```python
# Example: Battery installation data
title = "China EV battery installations hit 45.2 GWh in Jan 2025"
# Extracted:
{
    "year": 2025,
    "month": 1,
    "installation": 45.2,
    "unit": "GWh",
    "sourceUrl": "...",
    "sourceTitle": "..."
}
```

### API Endpoints for Industry Tables

Each table has a POST endpoint for data submission:

| Table | Endpoint | Key Fields |
|-------|----------|------------|
| ChinaBatteryInstallation | `/api/china-battery-installation` | year, month, installation |
| CaamNevSales | `/api/caam-nev-sales` | year, month, value, yoyChange |
| ChinaViaIndex | `/api/china-via-index` | year, month, value (%) |
| BatteryMakerMonthly | `/api/battery-maker-monthly` | maker, year, month, installation |
| PlantExports | `/api/plant-exports` | plant, brand, year, month, value |
| AutomakerRankings | `/api/automaker-rankings` | year, month, ranking, automaker, value |
| BatteryMakerRankings | `/api/battery-maker-rankings` | year, month, ranking, maker, value, scope |

### Pipeline Stats

The scraper tracks industry data processing:

```
Industry Data:
  Status: SUCCESS
  Classified: 3 articles
  Extracted: 2 articles
  Submitted: 2 records
  Errors: 0
  By Table: {'BatteryMakerMonthly': 1, 'ChinaViaIndex': 1}
```

---

## Anti-Detection Strategy

### Request Level

```python
CNEVDATA_CONFIG = {
    # User Agent rotation pool
    "user_agents": [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...",
    ],

    # Request interval (randomized)
    "min_delay": 3,      # Minimum delay seconds
    "max_delay": 8,      # Maximum delay seconds
}
```

### Behavior Simulation

| Strategy | Implementation |
|----------|----------------|
| Random delays | 3-8 seconds between requests |
| User-Agent rotation | Cycle through 5 different browsers |
| Session persistence | Maintain cookies across requests |
| Night execution | UTC 19:00 (Beijing 3:00 AM) - lower server load |

### Rate Control

| Limit | Value | Rationale |
|-------|-------|-----------|
| Weekly article limit | 100 | Stay under detection threshold |
| Batch delay | 1 minute | Short pause between page batches |
| Page delay | 3-8 seconds | Random delay between pages |
| Article concurrency | 10 workers | Parallel article processing (own API only) |
| Exponential backoff | 2x on 429/503 | Handle rate limiting gracefully |

---

## OCR Strategy

### Chart vs Table Distinction

Not all images benefit from OCR. The classifier sets `ocr_data_type` to distinguish:

| Image Type | `ocr_data_type` | OCR Action | Rationale |
|------------|-----------------|------------|-----------|
| **Line/bar charts** | `"chart"` | **Skipped** | GPT-4o Vision approximates pixel positions, giving inaccurate values. Key data point is in the title. |
| **Rankings tables** | `"rankings"` | Extracted | Discrete text values are read accurately |
| **Trend tables** | `"trend"` | **Skipped** | Trend diagrams are line/bar charts disguised as tables; GPT-4o Vision gives inaccurate values |
| **Vehicle specs** | `"specs"` | Extracted | Structured specification text |

Chart articles (VIA Index, Passenger Inventory, CPCA Production, etc.) have their key data point extracted from the title into dedicated industry tables.

### Parallel OCR Processing

OCR calls are batched and processed in parallel for performance:

| Setting | Value | Description |
|---------|-------|-------------|
| `ocr_concurrency` | 5 | Max parallel OCR calls |
| Batch trigger | End of each page | Process queued articles together |
| OCR filter | `ocr_data_type in ("rankings", "specs")` | Skip charts and trend diagrams |

This reduces scraping time from ~5.5 min to ~1-2 min for 3 pages (3x faster).

### When OCR is Needed

Two layers of filtering determine whether OCR runs:

1. **Title number check**: `needs_ocr = not has_number` — if the title has a significant number (4+ digits or comma-separated), OCR is skipped.
2. **OCR type filter**: `process_ocr_batch()` only processes articles with `ocr_data_type` in `("rankings", "specs")`. Chart-type articles (`ocr_data_type="chart"`) and trend diagrams (`ocr_data_type="trend"`) are always skipped — trend diagrams are visually similar to charts and GPT-4o Vision gives inaccurate values for them.

```python
# Layer 1: Title-based (in classifier)
has_number = bool(re.search(r'\d{1,3}(?:,\d{3})+|\d{4,}', title))
needs_ocr = not has_number

# Layer 2: Type-based (in process_ocr_batch)
OCR_ELIGIBLE_TYPES = {"rankings", "specs"}
ocr_articles = [a for a in articles if a.ocr_data_type in OCR_ELIGIBLE_TYPES]
```

### OCR Cost Estimate

| Item | Estimate |
|------|----------|
| Articles with data in title | ~70% (no OCR) |
| Chart articles (OCR skipped) | ~15% |
| Articles needing OCR (tables) | ~15% |
| GPT-4o Vision cost | ~$0.01-0.02/image |
| Monthly OCR images | ~8-12 |
| **Monthly OCR cost** | **$0.08-0.24** |

### GPT-4o Vision Prompts

**For Rankings Tables**:
```
Extract all data from this rankings/leaderboard table image.
Return as JSON array:
[{"rank": 1, "brand": "BYD", "value": 339854, "mom": 13.6, "yoy": -15.7, "share": 25.4}]
```

**For Vehicle Specs**:
```
Extract vehicle specifications from this image.
Return as JSON object with fields: brand, model, variant, price, dimensions, battery, range, etc.
```

---

## API Endpoints

### GET /api/ev-metrics

Query EV metrics with filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `brand` | String | Filter by brand (BYD, NIO, etc.) |
| `metric` | String | Filter by metric type |
| `periodType` | String | MONTHLY, QUARTERLY, YEARLY |
| `year` | Int | Filter by year |
| `period` | Int | Filter by period (1-12 for monthly) |
| `region` | String | Filter by region |
| `vehicleModel` | String | Filter by model |

**Example Response**:
```json
{
  "metrics": [
    {
      "id": "clx123...",
      "brand": "XPENG",
      "metric": "DELIVERY",
      "periodType": "MONTHLY",
      "year": 2025,
      "period": 1,
      "value": 20011,
      "yoyChange": -46.65,
      "momChange": -34.07
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150
  }
}
```

### POST /api/ev-metrics

Create or update a metric (upsert based on unique constraint).

### GET /api/vehicle-specs

Query vehicle specifications with filters for brand, type, segment, price range, and range.

### POST /api/vehicle-specs

Create or update a vehicle spec.

---

## Backfill Strategy

### Historical Data Scale

```
120 pages × ~10 articles/page = ~1,200 articles
├── ~70% title has data = ~840 articles (no OCR)
├── ~20% needs OCR = ~240 articles (~$2.40-4.80)
└── ~10% skip = ~120 articles
```

### Backfill Configuration

```python
BACKFILL_CONFIG = {
    "batch_size": 10,           # Pages per batch
    "batch_delay": 60,          # 1 minute between batches
    "page_delay": (3, 8),       # 3-8 seconds between pages
    "article_delay": (1, 3),    # Per-article delay (used in sequential mode)
    "ocr_concurrency": 5,       # Parallel OCR limit
    "article_concurrency": 10,  # Parallel article processing workers
}
```

### Parallel Article Processing

Page fetches remain sequential (anti-detection for cnevdata.com), but article processing within each page runs in parallel using `ThreadPoolExecutor`. Article processing only hits our own API (Vercel), so parallelization is safe.

| Setting | Default | CLI Flag | Description |
|---------|---------|----------|-------------|
| `article_concurrency` | 10 | `--concurrency` | Number of parallel workers per page |

**Speedup example (10 pages, ~200 articles):**

| Phase | Sequential | Parallel (10 workers) |
|-------|-----------|----------------------|
| Page fetches | 55s | 55s (unchanged) |
| Article processing | ~400s | ~15s |
| Batch delay | 60s | 60s (unchanged) |
| **Total** | **~8.5 min** | **~2 min** |

Use `--concurrency 1` to fall back to sequential processing.

### Phased Approach

| Phase | Pages | Duration | Method |
|-------|-------|----------|--------|
| 1. Recent data | 1-10 | Same day | Manual run (~2 min) |
| 2. Mid-term | 11-50 | 1-2 days | 20 pages/batch |
| 3. Historical | 51-120 | 3-5 days | GitHub Actions |

### Checkpoint Resume

The backfill script saves progress to `.cnevdata_checkpoint.json`:

```json
{
  "last_page": 15,
  "processed_urls": ["https://cnevdata.com/p/...", ...],
  "saved_at": "2025-02-04T12:00:00"
}
```

Resume with: `python backfill_cnevdata.py --resume`

---

## GitHub Actions Workflow

### Schedule

- **When**: Every Sunday at UTC 19:00 (Beijing Monday 3:00 AM)
- **Pages**: 1-3 (newest articles)
- **Trigger**: Also supports manual dispatch

### Configuration

```yaml
name: CnEVData Weekly Scraper
on:
  schedule:
    - cron: '0 19 * * 0'  # Sunday UTC 19:00
  workflow_dispatch:
    inputs:
      pages:
        description: 'Page range (e.g., "1-5")'
        default: '1-3'
      dry_run:
        type: boolean
        default: false
      enable_ocr:
        type: boolean
        default: true
      concurrency:
        description: 'Parallel article processing workers'
        default: '10'
```

**Note**: OCR is enabled by default for both scheduled and manual runs. Scheduled runs always pass `--enable-ocr` to extract tabular data from rankings and specs images.

---

## Files Structure

```
scraper/
├── sources/
│   └── cnevdata.py           # CnEVData source adapter
├── extractors/
│   ├── __init__.py
│   ├── title_parser.py       # Parse metrics from titles
│   ├── summary_parser.py     # Extract YoY/MoM from summaries
│   ├── classifier.py         # Article type classification (12+ types)
│   ├── industry_extractor.py # Extract data for 12 industry tables (NEW)
│   ├── image_ocr.py          # GPT-4o Vision OCR
│   ├── spec_extractor.py     # Vehicle spec extraction
│   └── table_extractor.py    # Rankings table extraction
├── api_client.py             # HTTP client for industry APIs (NEW)
├── backfill_cnevdata.py      # Historical backfill script
├── config.py                 # Configuration (API_BASE_URL added)
├── main.py                   # Entry point (industry data pipeline)
└── tests/
    ├── test_cnevdata_posts.py    # Image URL normalization tests
    └── ...

src/app/api/
├── ev-metrics/
│   └── route.ts              # EV metrics API
├── vehicle-specs/
│   └── route.ts              # Vehicle specs API
├── china-battery-installation/
│   └── route.ts              # Battery installation API (NEW)
├── caam-nev-sales/
│   └── route.ts              # CAAM NEV sales API (NEW)
├── china-via-index/
│   └── route.ts              # VIA Index API (NEW)
├── battery-maker-monthly/
│   └── route.ts              # Battery maker monthly API (NEW)
├── plant-exports/
│   └── route.ts              # Plant exports API (NEW)
├── automaker-rankings/
│   └── route.ts              # Automaker rankings API (NEW)
├── battery-maker-rankings/
│   └── route.ts              # Battery maker rankings API (NEW)
└── ... (6 more industry table APIs)

.github/workflows/
└── cnevdata-scraper.yml      # Weekly scraper workflow

prisma/
└── schema.prisma             # Database schema (12 industry tables added)
```

---

## Verification

### Unit Test Examples

```python
# Test title parser
parser = TitleParser()

# Should parse successfully
result = parser.parse("Xpeng deliveries in Jan: 20,011")
assert result.brand == "XPENG"
assert result.metric_type == "DELIVERY"
assert result.value == 20011
assert result.month == 1

# Should determine OCR need
assert parser.needs_ocr("Xpeng deliveries in Jan: 20,011") == False
assert parser.needs_ocr("Full CPCA rankings: Top-selling models") == True

# Model extraction should NOT match numbers from comma-formatted values
result = parser.parse("Tesla China wholesale sales in Jan: 69,129")
assert result.vehicle_model is None  # "129" preceded by comma - NOT a model

result = parser.parse("BYD NEV sales in Jan: 210,051")
assert result.vehicle_model is None  # "210" followed by comma - NOT a model

# Model extraction should match standalone Zeekr-style models
result = parser.parse("Zeekr 001 deliveries in Jan: 15,000")
assert result.vehicle_model == "001"
```

### Title Parser Model Pattern

The title parser uses regex patterns to extract vehicle models. The Zeekr-style pattern uses negative lookbehind AND lookahead to avoid matching numbers from comma-formatted values:

```python
r'(?<![,\d])([0-9]{3}[Xx]?)(?![,\d])'  # Zeekr models like 001, 007, 009
```

This ensures:
- `Zeekr 001 sales` -> matches `001`
- `Tesla China wholesale: 69,129` -> does NOT match `129` (preceded by comma)
- `BYD NEV sales: 210,051` -> does NOT match `210` (followed by comma)

### Integration Test

```bash
# Dry run scraper (parallel, default 10 workers)
python scraper/backfill_cnevdata.py --pages 1-2 --dry-run

# Dry run with sequential fallback
python scraper/backfill_cnevdata.py --pages 1-2 --dry-run --concurrency 1

# Custom concurrency
python scraper/backfill_cnevdata.py --pages 1-5 --concurrency 5
```

### Database Verification

```sql
SELECT brand, metric, year, period, value, "yoyChange"
FROM "EVMetric"
WHERE brand = 'XPENG'
ORDER BY year DESC, period DESC
LIMIT 5;
```

---

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| GPT-4o Vision OCR (tables only, charts skipped) | $0.08-0.24 |
| GitHub Actions | Free (public repo) |
| Database storage | Included in Supabase free tier |
| **Total** | **~$0.25/month** |
