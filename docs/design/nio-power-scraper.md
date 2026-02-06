# NIO Power Charger Map Scraper

> **Last Updated**: February 6, 2026
> **Status**: Implemented

## Overview

A standalone pipeline that scrapes NIO Power charger map statistics from their SPA page using Playwright. Captures real-time infrastructure metrics (swap stations, charging stations, cumulative usage) and stores snapshots via the `NioPowerSnapshot` API endpoint.

### Key Differences from Article Scraper

| Aspect | Article Scraper (`main.py`) | NIO Power Scraper |
|--------|----------------------------|-------------------|
| **Data type** | News articles from multiple sources | Single infrastructure snapshot |
| **Technique** | HTTP requests + HTML parsing | Playwright SPA rendering |
| **AI processing** | Translation, scoring, classification | None needed |
| **Dependencies** | DeepSeek/OpenAI, webhook, X publishing | Only Playwright + API client |
| **Schedule** | Every 6 hours | Every 6 hours (independent) |
| **Failure impact** | Isolated from NIO Power | Isolated from article scraping |

---

## Architecture

### Data Source

**URL**: `https://chargermap.nio.com/pe/h5/static/chargermap#/`

This is a single-page application (SPA) that renders real-time NIO Power infrastructure metrics. The page loads data dynamically via JavaScript, requiring a headless browser.

### Scraping Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    NIO POWER SCRAPER FLOW                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐   │
│  │  Playwright  │ ──▶ │  Wait for   │ ──▶ │  Extract     │   │
│  │  Launch &    │     │  "截至" text │     │  innerText   │   │
│  │  Navigate    │     │  + settle   │     │  from body   │   │
│  └─────────────┘     └─────────────┘     └──────┬───────┘   │
│                                                   │           │
│                                                   ▼           │
│                                          ┌──────────────┐    │
│                                          │  Regex parse │    │
│                                          │  metrics     │    │
│                                          └──────┬───────┘    │
│                                                  │            │
│                                                  ▼            │
│                                         ┌───────────────┐    │
│                                         │ Submit to API │    │
│                                         │ NioPowerSnapshot│  │
│                                         └───────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Metrics Captured

| Metric | Chinese Label | Example Value |
|--------|---------------|---------------|
| Total stations | 蔚来能源充换电站总数 | 4,898 |
| Swap stations | 蔚来能源换电站 | 2,863 |
| Highway swap stations | 其中高速公路换电站 | 863 |
| Cumulative swaps | 实时累计换电次数 | 100,016,310 |
| Charging stations | 蔚来能源充电站 | 4,898 |
| Charging piles | (slash-separated with stations) | 28,035 |
| Cumulative charges | 实时累计充电次数 | 52,000,000 |
| Third-party piles | 接入第三方充电桩 | 1,200,000 |
| Third-party usage % | 第三方用户占比 | 73.5 |

---

## Files

| File | Purpose |
|------|---------|
| `scraper/sources/nio_power.py` | `NioPowerScraper` class and metric parsing logic |
| `scraper/scrape_nio_power.py` | Standalone CLI entry point |
| `scraper/api_client.py` | `EVPlatformAPI` with `NioPowerSnapshot` endpoint mapping |
| `src/app/api/nio-power-snapshot/route.ts` | API route for receiving snapshots |
| `.github/workflows/nio-power-scraper.yml` | GitHub Actions workflow |

### `scraper/sources/nio_power.py`

Core scraper module with:
- `NioPowerData` dataclass — holds all metrics with `to_api_dict()` for API submission
- `NioPowerScraper` class — Playwright-based scraper with configurable settle time
- Regex parsing functions (`parse_timestamp`, `find_number_after`, `find_float_after`, `find_slash_numbers`)
- Validation: rejects result if >3 of 7 required fields are missing

### `scraper/scrape_nio_power.py`

Standalone CLI script (like `backfill_cnevdata.py`):

```bash
# Dry run — prints metrics, no API submission
python scrape_nio_power.py --dry-run

# Live — scrapes and submits to API
python scrape_nio_power.py
```

Exit code 1 on failure (scrape failure or API submission failure).

---

## GitHub Actions Workflow

### Configuration

```yaml
name: NIO Power Charger Map Scraper
on:
  schedule:
    - cron: '0 */6 * * *'    # Every 6 hours
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false
```

### Steps

1. Checkout code
2. Setup Python 3.11
3. Install pip dependencies
4. Install Playwright Chromium
5. Run `scrape_nio_power.py` (with `--dry-run` for manual trigger if selected)

### Environment

| Variable | Source | Purpose |
|----------|--------|---------|
| `WEBHOOK_URL` | GitHub Secrets | Used by `config.py` to derive `API_BASE_URL` |

### Failure Notifications

- Discord webhook notification
- Email notification via SMTP

### Timeout

10 minutes — Playwright page load (~30s) + 5s settle time + API submission is fast.

---

## Database Schema

### `NioPowerSnapshot` (Prisma)

Stores point-in-time snapshots of NIO Power infrastructure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Auto-generated CUID |
| `asOfTime` | DateTime | Timestamp from the page ("截至" time) |
| `totalStations` | Int | Total charging + swapping stations |
| `swapStations` | Int | Battery swap stations |
| `highwaySwapStations` | Int | Highway swap stations |
| `cumulativeSwaps` | Int | Total battery swaps performed |
| `chargingStations` | Int | Charging stations |
| `chargingPiles` | Int | Individual charging piles |
| `cumulativeCharges` | Int | Total charging sessions |
| `thirdPartyPiles` | Int | Connected third-party piles |
| `thirdPartyUsagePercent` | Float | Third-party user percentage |

Unique constraint on `asOfTime` prevents duplicate snapshots.

---

## Design Decisions

### Why a standalone pipeline?

NIO Power is fundamentally different from the article scraper:

1. **Single page, single snapshot** — no article list, no pagination, no AI processing
2. **Playwright dependency** — the article scraper uses HTTP requests; mixing Playwright adds complexity and startup time
3. **Independent scheduling** — frequency can change without affecting news scraping
4. **Independent re-runs** — `workflow_dispatch` with `--dry-run` for debugging
5. **Failure isolation** — NIO Power failure doesn't block article scraping, and vice versa

### Why regex instead of structured selectors?

The NIO Power SPA renders metrics as text within nested components. The page structure changes frequently, but the Chinese labels (蔚来能源换电站, 实时累计换电次数, etc.) are stable. Regex on `document.body.innerText` is more resilient than CSS selectors.

### Settle time

The page uses animated counters that tick up on load. A 5-second settle wait ensures the final values are captured rather than intermediate animation states.
