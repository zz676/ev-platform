# CnEVData Scraper & EV Sales Data Pipeline

> **Last Updated**: February 5, 2025
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

| Type | Example Title | OCR? | Target Table |
|------|---------------|------|--------------|
| BRAND_METRIC | "Xpeng deliveries in Jan: 20,011" | No | EVMetric |
| MODEL_BREAKDOWN | "Tesla Apr sales breakdown: 13,196 Model 3s" | No | EVMetric |
| REGIONAL_DATA | "Shanghai Apr NEV license plates: 45,000" | No | EVMetric |
| RANKINGS_TABLE | "Full CPCA rankings: Top-selling models" | Yes | EVMetric |
| DATA_TABLE | "Data Table: China NEV sales Dec 2025" | Yes | EVMetric |
| VEHICLE_SPEC | "NIO EC7: Main specs" | Yes | VehicleSpec |
| INDUSTRY_INDICATOR | "China auto dealer inventory drops" | Yes | EVMetric |
| BATTERY_METRIC | "CATL battery installations: 25.6 GWh" | No | EVMetric |

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
| Article delay | 1-3 seconds | Random delay between articles |
| Exponential backoff | 2x on 429/503 | Handle rate limiting gracefully |

---

## OCR Strategy

### Parallel OCR Processing

OCR calls are batched and processed in parallel for performance:

| Setting | Value | Description |
|---------|-------|-------------|
| `ocr_concurrency` | 5 | Max parallel OCR calls |
| Batch trigger | End of each page | Process queued articles together |

This reduces scraping time from ~5.5 min to ~1-2 min for 3 pages (3x faster).

### When OCR is Needed

```python
def needs_ocr(title: str) -> bool:
    """OCR needed only when title has no significant numbers."""
    # Has numbers like "20,011" or "210051"?
    has_number = bool(re.search(r'\d{1,3}(?:,\d{3})+|\d{4,}', title))
    return not has_number
```

### OCR Cost Estimate

| Item | Estimate |
|------|----------|
| Articles with data in title | ~70% (no OCR) |
| Articles needing OCR | ~30% |
| GPT-4o Vision cost | ~$0.01-0.02/image |
| Monthly OCR images | ~15-20 |
| **Monthly OCR cost** | **$0.15-0.40** |

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
    "article_delay": (1, 3),    # 1-3 seconds between articles
    "ocr_concurrency": 5,       # Parallel OCR limit
}
```

### Phased Approach

| Phase | Pages | Duration | Method |
|-------|-------|----------|--------|
| 1. Recent data | 1-10 | Same day | Manual run (~3-4 min) |
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
        default: false
```

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
│   ├── classifier.py         # Article type classification
│   ├── image_ocr.py          # GPT-4o Vision OCR
│   ├── spec_extractor.py     # Vehicle spec extraction
│   └── table_extractor.py    # Rankings table extraction
├── backfill_cnevdata.py      # Historical backfill script
├── config.py                 # Configuration (updated)
└── main.py                   # Entry point (updated)

src/app/api/
├── ev-metrics/
│   └── route.ts              # EV metrics API
└── vehicle-specs/
    └── route.ts              # Vehicle specs API

.github/workflows/
└── cnevdata-scraper.yml      # Weekly scraper workflow

prisma/
└── schema.prisma             # Database schema (updated)
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
assert result.vehicle_model is None  # "129" is NOT a model

# Model extraction should match standalone Zeekr-style models
result = parser.parse("Zeekr 001 deliveries in Jan: 15,000")
assert result.vehicle_model == "001"
```

### Title Parser Model Pattern

The title parser uses regex patterns to extract vehicle models. The Zeekr-style pattern uses negative lookbehind to avoid matching numbers from comma-formatted values:

```python
r'(?<![,\d])([0-9]{3}[Xx]?)\b'  # Zeekr models like 001, 007, 009
```

This ensures:
- `Zeekr 001 sales` -> matches `001`
- `Tesla China wholesale: 69,129` -> does NOT match `129` (preceded by comma)

### Integration Test

```bash
# Dry run scraper
python scraper/backfill_cnevdata.py --pages 1-2 --dry-run
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
| GPT-4o Vision OCR | $0.15-0.40 |
| GitHub Actions | Free (public repo) |
| Database storage | Included in Supabase free tier |
| **Total** | **~$0.40/month** |
